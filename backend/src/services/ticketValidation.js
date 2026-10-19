const db = require("../db");
const { audit } = require("../utils/notify");
const { forbidden } = require("../utils/errors");
const { parseQrPayload, isValidSignature } = require("../utils/qr");

const BASE_TICKET_QUERY = `
  SELECT t.*,
         e.id AS event_id, e.title AS event_title, e.date_time, e.end_time, e.location,
         e.venue_name, e.venue_address, e.poster_url, e.organizer_name, e.club_id,
         e.university_id, e.status AS event_status,
         un.name AS university_name,
         tt.name AS ticket_type, tt.price,
         u.name AS holder_name, u.email AS holder_email,
         c.name AS club_name, c.lead_user_id,
         lp.status AS payment_status
  FROM tickets t
  JOIN events e ON e.id = t.event_id
  LEFT JOIN universities un ON un.id = e.university_id
  JOIN clubs c ON c.id = e.club_id
  JOIN users u ON u.id = t.holder_id
  JOIN ticket_types tt ON tt.id = t.ticket_type_id
  LEFT JOIN LATERAL (
    SELECT p.status FROM payments p WHERE p.transaction_type = 'ticket' AND p.transaction_id = t.id ORDER BY p.created_at DESC LIMIT 1
  ) lp ON true
`;

/**
 * Normalizes and classifies any ticket input:
 * - URL: "https://.../tickets/verify/<uuid>.<hmac>"
 * - Signed QR string: "<uuid>.<hmac>"
 * - UUID: "<uuid>"
 * - Ticket Number: "GIB-F7A79799", "gib-f7a79799", "F7A79799", "GIBF7A79799"
 */
function parseTicketIdentifier(rawInput) {
  if (!rawInput || typeof rawInput !== "string") {
    return { type: "invalid", raw: rawInput };
  }
  let clean = rawInput.trim();
  if (!clean) {
    return { type: "invalid", raw: rawInput };
  }

  // 1. URL extraction
  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.includes("/tickets/verify/")) {
    try {
      const u = new URL(clean.startsWith("http") ? clean : `http://dummy${clean}`);
      const segments = u.pathname.split("/").filter(Boolean);
      clean = segments[segments.length - 1] || "";
      clean = clean.split("?")[0].trim();
    } catch (_) {
      const parts = clean.split("/tickets/verify/");
      clean = parts[parts.length - 1].split("?")[0].trim();
    }
  }

  // 2. Signed QR payload: ticketId.signature
  if (clean.includes(".")) {
    const parsed = parseQrPayload(clean);
    if (parsed && parsed.ticketId && parsed.signature) {
      return {
        type: "qr",
        ticketId: parsed.ticketId.trim(),
        signature: parsed.signature.trim(),
        raw: clean,
      };
    }
  }

  // 3. UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(clean)) {
    return {
      type: "uuid",
      ticketId: clean.toLowerCase(),
      raw: clean,
    };
  }

  // 4. Ticket Number
  const upper = clean.toUpperCase();
  // Standard format GIB-XXXXXXXX
  const gibMatch = upper.match(/^GIB-([A-Z0-9_-]{4,16})$/);
  if (gibMatch) {
    return {
      type: "ticket_number",
      ticketNumber: upper,
      code: gibMatch[1],
      raw: clean,
    };
  }

  // 8-hex character without prefix (e.g. F7A79799)
  if (/^[0-9A-F]{8}$/.test(upper)) {
    return {
      type: "ticket_number",
      ticketNumber: `GIB-${upper}`,
      code: upper,
      raw: clean,
    };
  }

  // Without hyphen: GIBF7A79799
  if (/^GIB[0-9A-F]{8}$/.test(upper)) {
    const code = upper.slice(3);
    return {
      type: "ticket_number",
      ticketNumber: `GIB-${code}`,
      code,
      raw: clean,
    };
  }

  // General alphanumeric ticket number fallback
  if (/^[A-Z0-9_-]{4,20}$/.test(upper)) {
    return {
      type: "ticket_number",
      ticketNumber: upper.startsWith("GIB-") ? upper : `GIB-${upper}`,
      raw: clean,
    };
  }

  return { type: "invalid", raw: clean };
}

/**
 * Resolves the underlying ticket record and performs cryptographic and tenant checks.
 */
async function resolveTicket({ identifier, expectedTicketId, scannerUser, eventId, client }) {
  const exec = client || db;
  const parsed = parseTicketIdentifier(identifier);

  if (parsed.type === "invalid") {
    await audit(scannerUser?.id, "ticket.scan", "ticket", expectedTicketId || null, {
      result: "INVALID",
      reason: "malformed_token",
      raw: parsed.raw,
    });
    return {
      errorResult: {
        result: "INVALID",
        reason: "Malformed or mismatched QR token",
        ticketId: expectedTicketId || null,
        ticketIdentifier: parsed.raw,
      },
    };
  }

  let ticketRow = null;

  if (parsed.type === "qr") {
    if (expectedTicketId && parsed.ticketId !== expectedTicketId) {
      await audit(scannerUser?.id, "ticket.scan", "ticket", expectedTicketId, {
        result: "INVALID",
        reason: "mismatched_ticket_id",
      });
      return {
        errorResult: {
          result: "INVALID",
          reason: "Malformed or mismatched QR token",
          ticketId: expectedTicketId,
        },
      };
    }

    if (!isValidSignature(parsed.ticketId, parsed.signature)) {
      await audit(scannerUser?.id, "ticket.scan", "ticket", parsed.ticketId, {
        result: "INVALID",
        reason: "bad_signature",
      });
      return {
        errorResult: {
          result: "INVALID",
          reason: "This QR code was not issued by Gibiyachin (signature mismatch)",
          ticketId: parsed.ticketId,
        },
      };
    }

    const { rows } = await exec.query(`${BASE_TICKET_QUERY} WHERE t.id = $1`, [parsed.ticketId]);
    ticketRow = rows[0];
  } else if (parsed.type === "ticket_number") {
    const { rows } = await exec.query(
      `${BASE_TICKET_QUERY} WHERE UPPER(t.ticket_number) = UPPER($1) OR UPPER(t.ticket_number) = UPPER($2) OR t.ticket_number = $1`,
      [parsed.ticketNumber, parsed.raw]
    );
    ticketRow = rows[0];
    if (ticketRow && expectedTicketId && ticketRow.id !== expectedTicketId) {
      return {
        errorResult: {
          result: "INVALID",
          reason: "Ticket number does not match expected ticket record",
          ticketId: expectedTicketId,
        },
      };
    }
  } else if (parsed.type === "uuid") {
    if (expectedTicketId && parsed.ticketId !== expectedTicketId) {
      return {
        errorResult: {
          result: "INVALID",
          reason: "Mismatched ticket ID",
          ticketId: expectedTicketId,
        },
      };
    }
    const { rows } = await exec.query(`${BASE_TICKET_QUERY} WHERE t.id = $1`, [parsed.ticketId]);
    ticketRow = rows[0];
  }

  if (!ticketRow) {
    await audit(scannerUser?.id, "ticket.scan", "ticket", null, {
      result: "NOT_FOUND",
      identifier: parsed.raw,
    });
    return {
      errorResult: {
        result: "NOT_FOUND",
        reason: `Ticket "${parsed.raw}" does not exist in the system.`,
        ticketIdentifier: parsed.raw,
      },
    };
  }

  // Authorization / Multi-tenant checks
  if (scannerUser) {
    if (scannerUser.role === "organizer") {
      if (ticketRow.lead_user_id !== scannerUser.id) {
        throw forbidden("You are not authorized to scan tickets for this event");
      }
    } else if (scannerUser.role === "admin") {
      if (ticketRow.university_id !== scannerUser.university_id) {
        throw forbidden("You are not authorized to scan tickets for another university");
      }
    }
  }

  // Event matching check: If eventId was provided, verify it matches
  if (eventId && ticketRow.event_id !== eventId) {
    await audit(scannerUser?.id, "ticket.scan", "ticket", ticketRow.id, {
      result: "WRONG_EVENT",
      ticketEventId: ticketRow.event_id,
      scannerEventId: eventId,
    });
    return {
      errorResult: {
        result: "WRONG_EVENT",
        eligible: false,
        reason: `This ticket is for a different event: "${ticketRow.event_title}". Not valid for admission to this event.`,
        ticket: ticketRow,
        attendeeName: ticketRow.holder_name,
        ticketType: ticketRow.ticket_type,
        ticketNumber: ticketRow.ticket_number,
        eventTitle: ticketRow.event_title,
      },
    };
  }

  return { ticket: ticketRow, parsed };
}

/**
 * Main entrance validation function used by camera QR scans, manual ticket number entry,
 * attendee lookup, and check-in.
 */
async function validateTicketForEntry({
  identifier,
  expectedTicketId = null,
  scannerUser,
  eventId = null,
  action = "inspect", // "inspect" | "check_in"
  deviceInfo = null,
  client = null,
}) {
  const resolved = await resolveTicket({ identifier, expectedTicketId, scannerUser, eventId, client });
  if (resolved.errorResult) return resolved.errorResult;
  const { ticket } = resolved;

  // 1. Event Cancelled check
  if (ticket.event_status === "cancelled") {
    await audit(scannerUser?.id, action === "check_in" ? "ticket.checkin" : "ticket.inspect", "ticket", ticket.id, {
      result: "EVENT_CANCELLED",
    });
    return {
      result: "EVENT_CANCELLED",
      eligible: false,
      ticket,
      ticketId: ticket.id,
      attendeeName: ticket.holder_name,
      ticketType: ticket.ticket_type,
      ticketNumber: ticket.ticket_number,
      eventTitle: ticket.event_title,
      reason: "Event has been cancelled. Admissions are closed.",
    };
  }

  // 2. Check if already used
  if (ticket.status === "used") {
    await audit(scannerUser?.id, action === "check_in" ? "ticket.checkin" : "ticket.inspect", "ticket", ticket.id, {
      result: "ALREADY_USED",
    });
    return {
      result: "ALREADY_USED",
      eligible: false,
      ticket,
      ticketId: ticket.id,
      attendeeName: ticket.holder_name,
      ticketType: ticket.ticket_type,
      ticketNumber: ticket.ticket_number,
      eventTitle: ticket.event_title,
      previousScanAt: ticket.used_at,
      reason: "Ticket has already been admitted.",
    };
  }

  // 3. Check if cancelled / void / refunded
  if (ticket.status === "cancelled") {
    await audit(scannerUser?.id, action === "check_in" ? "ticket.checkin" : "ticket.inspect", "ticket", ticket.id, {
      result: "CANCELLED",
    });
    return {
      result: "CANCELLED",
      eligible: false,
      ticket,
      ticketId: ticket.id,
      attendeeName: ticket.holder_name,
      ticketType: ticket.ticket_type,
      ticketNumber: ticket.ticket_number,
      eventTitle: ticket.event_title,
      reason: "Ticket has been cancelled or refunded.",
    };
  }

  // 4. Payment verification check
  const isPaid = Number(ticket.price) > 0;
  if (ticket.status === "reserved" || (isPaid && ticket.payment_status && ticket.payment_status !== "confirmed")) {
    await audit(scannerUser?.id, action === "check_in" ? "ticket.checkin" : "ticket.inspect", "ticket", ticket.id, {
      result: "PAYMENT_NOT_APPROVED",
    });
    return {
      result: "PAYMENT_NOT_APPROVED",
      eligible: false,
      ticket,
      ticketId: ticket.id,
      attendeeName: ticket.holder_name,
      ticketType: ticket.ticket_type,
      ticketNumber: ticket.ticket_number,
      eventTitle: ticket.event_title,
      reason: "Payment is pending verification. This ticket is not eligible for admission.",
    };
  }

  // 5. Active state check
  if (ticket.status !== "active") {
    await audit(scannerUser?.id, action === "check_in" ? "ticket.checkin" : "ticket.inspect", "ticket", ticket.id, {
      result: "INVALID",
      reason: ticket.status,
    });
    return {
      result: "INVALID",
      eligible: false,
      ticket,
      ticketId: ticket.id,
      reason: `Ticket status is "${ticket.status}"`,
    };
  }

  // Inspection mode: Return VALID preview
  if (action !== "check_in") {
    await audit(scannerUser?.id, "ticket.inspect", "ticket", ticket.id, { result: "VALID" });
    return {
      result: "VALID",
      eligible: true,
      ticket,
      attendeeName: ticket.holder_name,
      ticketType: ticket.ticket_type,
      ticketNumber: ticket.ticket_number,
      eventTitle: ticket.event_title,
      dateTime: ticket.date_time,
      venue: ticket.venue_name || ticket.location,
    };
  }

  // Check-In mode: Execute atomic admission inside transaction
  const executeAtomic = async (txClient) => {
    const { rows } = await txClient.query(
      `UPDATE tickets SET status = 'used', used_at = now(), used_by = $1
       WHERE id = $2 AND status = 'active'
         AND (SELECT status FROM events WHERE id = tickets.event_id) != 'cancelled'
       RETURNING *`,
      [scannerUser?.id, ticket.id]
    );

    if (!rows[0]) {
      const { rows: reread } = await txClient.query(
        `SELECT t.status, t.used_at, e.status AS event_status
         FROM tickets t JOIN events e ON e.id = t.event_id WHERE t.id = $1`,
        [ticket.id]
      );
      if (reread[0]?.event_status === "cancelled") {
        await audit(scannerUser?.id, "ticket.checkin", "ticket", ticket.id, { result: "EVENT_CANCELLED" });
        return { result: "EVENT_CANCELLED", reason: "Event has been cancelled. Admissions are closed.", ticketId: ticket.id };
      }
      if (reread[0]?.status === "used") {
        await audit(scannerUser?.id, "ticket.checkin", "ticket", ticket.id, { result: "ALREADY_USED", race: true });
        return { result: "ALREADY_USED", ticket, previousScanAt: reread[0]?.used_at, reason: "Ticket has already been admitted" };
      }
      if (reread[0]?.status === "cancelled") {
        await audit(scannerUser?.id, "ticket.checkin", "ticket", ticket.id, { result: "CANCELLED" });
        return { result: "CANCELLED", reason: "Ticket has been cancelled or refunded", ticketId: ticket.id };
      }
      return { result: "INVALID", reason: `Ticket status is "${reread[0]?.status || ticket.status}"`, ticketId: ticket.id };
    }

    const updated = rows[0];

    await txClient.query(
      `INSERT INTO ticket_checkins (ticket_id, event_id, staff_id, device_info)
       VALUES ($1, $2, $3, $4)`,
      [ticket.id, ticket.event_id, scannerUser?.id, deviceInfo || null]
    );

    await audit(scannerUser?.id, "ticket.checkin", "ticket", ticket.id, {
      result: "ADMIT",
      ticket_number: ticket.ticket_number,
    });

    return {
      result: "ADMIT",
      ticket: { ...ticket, ...updated },
      checkedInAt: updated.used_at,
      attendeeName: ticket.holder_name,
      ticketNumber: ticket.ticket_number,
      ticketType: ticket.ticket_type,
      eventTitle: ticket.event_title,
    };
  };

  if (client) {
    return await executeAtomic(client);
  }
  return await db.withTransaction(executeAtomic);
}

module.exports = {
  BASE_TICKET_QUERY,
  parseTicketIdentifier,
  resolveTicket,
  validateTicketForEntry,
};

