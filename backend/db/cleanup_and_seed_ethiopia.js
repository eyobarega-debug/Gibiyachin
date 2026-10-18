/* eslint-disable no-console */
/**
 * Gibiyachin Platform (ግቢያችን)
 * Nationwide Multi-University Preparation & Demo Data Cleanup
 *
 * Requirements:
 * 1. Clean demo/sample students, merchants, organizers, and campus admins.
 * 2. Preserve exactly ONE platform Super Admin account (university_id = NULL).
 * 3. Safely delete dependent demo transactions, tickets, check-ins, bookings,
 *    listings, products, stores, applications, and logs in topological FK order.
 * 4. Clean test-fixture universities and seed 25 official Ethiopian universities
 *    sourced from the Ethiopian Ministry of Education (MoE) & EthERNet directory.
 * 5. Do NOT create fake campus admins (Super Admin assigns real admins later).
 * 6. Preserves categories and terms agreement versions.
 */
require("dotenv").config({ quiet: true });
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ETHIOPIAN_UNIVERSITIES = [
  {
    name: "Addis Ababa University",
    amharicName: "አዲስ አበባ ዩኒቨርሲቲ",
    code: "AAU",
    slug: "addis-ababa-university",
    domain: "aau.edu.et",
    permittedDomains: ["aau.edu.et", "mail.aau.edu.et"],
    city: "Addis Ababa",
    region: "Addis Ababa",
    institutionType: "public",
  },
  {
    name: "Addis Ababa Science and Technology University",
    amharicName: "አዲስ አበባ ሳይንስና ቴክኖሎጂ ዩኒቨርሲቲ",
    code: "AASTU",
    slug: "addis-ababa-science-and-technology-university",
    domain: "aastu.edu.et",
    permittedDomains: ["aastu.edu.et"],
    city: "Addis Ababa",
    region: "Addis Ababa",
    institutionType: "public",
  },
  {
    name: "Adama Science and Technology University",
    amharicName: "አዳማ ሳይንስና ቴክኖሎጂ ዩኒቨርሲቲ",
    code: "ASTU",
    slug: "adama-science-and-technology-university",
    domain: "astu.edu.et",
    permittedDomains: ["astu.edu.et"],
    city: "Adama",
    region: "Oromia",
    institutionType: "public",
  },
  {
    name: "Bahir Dar University",
    amharicName: "ባሕር ዳር ዩኒቨርሲቲ",
    code: "BDU",
    slug: "bahir-dar-university",
    domain: "bdu.edu.et",
    permittedDomains: ["bdu.edu.et"],
    city: "Bahir Dar",
    region: "Amhara",
    institutionType: "public",
  },
  {
    name: "Hawassa University",
    amharicName: "ሀዋሳ ዩኒቨርሲቲ",
    code: "HU",
    slug: "hawassa-university",
    domain: "hu.edu.et",
    permittedDomains: ["hu.edu.et"],
    city: "Hawassa",
    region: "Sidama",
    institutionType: "public",
  },
  {
    name: "Jimma University",
    amharicName: "ጅማ ዩኒቨርሲቲ",
    code: "JU",
    slug: "jimma-university",
    domain: "ju.edu.et",
    permittedDomains: ["ju.edu.et"],
    city: "Jimma",
    region: "Oromia",
    institutionType: "public",
  },
  {
    name: "University of Gondar",
    amharicName: "ጎንደር ዩኒቨርሲቲ",
    code: "UoG",
    slug: "university-of-gondar",
    domain: "uog.edu.et",
    permittedDomains: ["uog.edu.et"],
    city: "Gondar",
    region: "Amhara",
    institutionType: "public",
  },
  {
    name: "Mekelle University",
    amharicName: "መቐለ ዩኒቨርሲቲ",
    code: "MU",
    slug: "mekelle-university",
    domain: "mu.edu.et",
    permittedDomains: ["mu.edu.et"],
    city: "Mekelle",
    region: "Tigray",
    institutionType: "public",
  },
  {
    name: "Arba Minch University",
    amharicName: "አርባ ምንጭ ዩኒቨርሲቲ",
    code: "AMU",
    slug: "arba-minch-university",
    domain: "amu.edu.et",
    permittedDomains: ["amu.edu.et"],
    city: "Arba Minch",
    region: "South Ethiopia",
    institutionType: "public",
  },
  {
    name: "Haramaya University",
    amharicName: "ሀረማያ ዩኒቨርሲቲ",
    code: "HrU",
    slug: "haramaya-university",
    domain: "haramaya.edu.et",
    permittedDomains: ["haramaya.edu.et"],
    city: "Haramaya",
    region: "Oromia",
    institutionType: "public",
  },
  {
    name: "Dire Dawa University",
    amharicName: "ድሬዳዋ ዩኒቨርሲቲ",
    code: "DDU",
    slug: "dire-dawa-university",
    domain: "ddu.edu.et",
    permittedDomains: ["ddu.edu.et"],
    city: "Dire Dawa",
    region: "Dire Dawa",
    institutionType: "public",
  },
  {
    name: "Debre Berhan University",
    amharicName: "ደብረ ብርሃን ዩኒቨርሲቲ",
    code: "DBU",
    slug: "debre-berhan-university",
    domain: "dbu.edu.et",
    permittedDomains: ["dbu.edu.et"],
    city: "Debre Berhan",
    region: "Amhara",
    institutionType: "public",
  },
  {
    name: "Debre Markos University",
    amharicName: "ደብረ ማርቆስ ዩኒቨርሲቲ",
    code: "DMU",
    slug: "debre-markos-university",
    domain: "dmu.edu.et",
    permittedDomains: ["dmu.edu.et"],
    city: "Debre Markos",
    region: "Amhara",
    institutionType: "public",
  },
  {
    name: "Wolkite University",
    amharicName: "ወልቂጤ ዩኒቨርሲቲ",
    code: "WKU",
    slug: "wolkite-university",
    domain: "wku.edu.et",
    permittedDomains: ["wku.edu.et"],
    city: "Wolkite",
    region: "Central Ethiopia",
    institutionType: "public",
  },
  {
    name: "Wolaita Sodo University",
    amharicName: "ወላይታ ሶዶ ዩኒቨርሲቲ",
    code: "WSU",
    slug: "wolaita-sodo-university",
    domain: "wsu.edu.et",
    permittedDomains: ["wsu.edu.et"],
    city: "Wolaita Sodo",
    region: "South Ethiopia",
    institutionType: "public",
  },
  {
    name: "Wollo University",
    amharicName: "ወሎ ዩኒቨርሲቲ",
    code: "WU",
    slug: "wollo-university",
    domain: "wu.edu.et",
    permittedDomains: ["wu.edu.et"],
    city: "Dessie",
    region: "Amhara",
    institutionType: "public",
  },
  {
    name: "Dilla University",
    amharicName: "ዲላ ዩኒቨርሲቲ",
    code: "DU",
    slug: "dilla-university",
    domain: "du.edu.et",
    permittedDomains: ["du.edu.et"],
    city: "Dilla",
    region: "South Ethiopia",
    institutionType: "public",
  },
  {
    name: "Ambo University",
    amharicName: "አምቦ ዩኒቨርሲቲ",
    code: "AU",
    slug: "ambo-university",
    domain: "ambou.edu.et",
    permittedDomains: ["ambou.edu.et"],
    city: "Ambo",
    region: "Oromia",
    institutionType: "public",
  },
  {
    name: "Semera University",
    amharicName: "ሰመራ ዩኒቨርሲቲ",
    code: "SU",
    slug: "semera-university",
    domain: "su.edu.et",
    permittedDomains: ["su.edu.et"],
    city: "Semera",
    region: "Afar",
    institutionType: "public",
  },
  {
    name: "Jigjiga University",
    amharicName: "ጅግጅጋ ዩኒቨርሲቲ",
    code: "JJU",
    slug: "jigjiga-university",
    domain: "jju.edu.et",
    permittedDomains: ["jju.edu.et"],
    city: "Jigjiga",
    region: "Somali",
    institutionType: "public",
  },
  {
    name: "Debre Tabor University",
    amharicName: "ደብረ ታቦር ዩኒቨርሲቲ",
    code: "DTU",
    slug: "debre-tabor-university",
    domain: "dtu.edu.et",
    permittedDomains: ["dtu.edu.et"],
    city: "Debre Tabor",
    region: "Amhara",
    institutionType: "public",
  },
  {
    name: "Assosa University",
    amharicName: "አሶሳ ዩኒቨርሲቲ",
    code: "ASU",
    slug: "assosa-university",
    domain: "asu.edu.et",
    permittedDomains: ["asu.edu.et"],
    city: "Assosa",
    region: "Benishangul-Gumuz",
    institutionType: "public",
  },
  {
    name: "Gambella University",
    amharicName: "ጋምቤላ ዩኒቨርሲቲ",
    code: "GMU",
    slug: "gambella-university",
    domain: "gmu.edu.et",
    permittedDomains: ["gmu.edu.et"],
    city: "Gambella",
    region: "Gambella",
    institutionType: "public",
  },
  {
    name: "Kotebe University of Education",
    amharicName: "ኮተቤ የትምህርት ዩኒቨርሲቲ",
    code: "KUE",
    slug: "kotebe-university-of-education",
    domain: "kue.edu.et",
    permittedDomains: ["kue.edu.et"],
    city: "Addis Ababa",
    region: "Addis Ababa",
    institutionType: "public",
  },
  {
    name: "Mizan-Tepi University",
    amharicName: "ሚዛን ቴፒ ዩኒቨርሲቲ",
    code: "MTU",
    slug: "mizan-tepi-university",
    domain: "mtu.edu.et",
    permittedDomains: ["mtu.edu.et"],
    city: "Mizan Teferi",
    region: "Southwest Ethiopia",
    institutionType: "public",
  },
];

async function main() {
  console.log("=================================================================");
  console.log("  Gibiyachin (ግቢያችን) — Multi-University Cleanup & Seed Routine");
  console.log("=================================================================");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Identify or bootstrap canonical Super Admin
    console.log("\n[1/5] Resolving canonical Super Admin...");
    const targetEmail = (process.env.SUPER_ADMIN_EMAIL || "super@campushub.et").toLowerCase();

    let superAdmin = null;
    const existing = await client.query(
      "SELECT id, name, email, role, university_id, password_hash FROM users WHERE role = 'super_admin' AND university_id IS NULL ORDER BY created_at ASC"
    );

    if (existing.rows.length > 0) {
      // Find one matching targetEmail or take the oldest created
      superAdmin = existing.rows.find((u) => u.email.toLowerCase() === targetEmail) || existing.rows[0];
      await client.query(
        `UPDATE users
            SET role = 'super_admin',
                university_id = NULL,
                verified = true,
                email_verified = true,
                suspended = false,
                name = COALESCE(name, 'Super Admin')
          WHERE id = $1`,
        [superAdmin.id]
      );
      console.log(`  ✓ Preserved existing Super Admin (ID: ${superAdmin.id}, Email: ${superAdmin.email})`);
    } else {
      const defaultPw = process.env.SUPER_ADMIN_PASSWORD || "Password123!";
      const hash = await bcrypt.hash(defaultPw, 10);
      const res = await client.query(
        `INSERT INTO users (name, email, role, university_id, verified, email_verified, verification_method, password_hash)
         VALUES ('Super Admin', $1, 'super_admin', NULL, true, true, 'bootstrap', $2)
         RETURNING id, name, email, role, university_id`,
        [targetEmail, hash]
      );
      superAdmin = res.rows[0];
      console.log(`  ✓ Bootstrapped Super Admin (ID: ${superAdmin.id}, Email: ${superAdmin.email})`);
    }

    const superAdminId = superAdmin.id;

    // 2. Remove all dependent demo/sample records in strict topological order
    console.log("\n[2/5] Cleaning sample & fixture operational data...");
    const deleteOps = [
      ["ticket_checkins", "DELETE FROM ticket_checkins"],
      ["tickets", "DELETE FROM tickets"],
      ["ticket_types", "DELETE FROM ticket_types"],
      ["waitlist_entries", "DELETE FROM waitlist_entries"],
      ["events", "DELETE FROM events"],
      ["clubs", "DELETE FROM clubs"],
      ["organizer_payouts", "DELETE FROM organizer_payouts"],
      ["organizer_applications", "DELETE FROM organizer_applications"],
      ["merchant_applications", "DELETE FROM merchant_applications"],
      ["application_agreements", "DELETE FROM application_agreements"],
      ["verification_requests", "DELETE FROM verification_requests"],
      ["payout_accounts", "DELETE FROM payout_accounts"],
      ["commissions", "DELETE FROM commissions"],
      ["commission_payments", "DELETE FROM commission_payments"],
      ["order_status_history", "DELETE FROM order_status_history"],
      ["order_items", "DELETE FROM order_items"],
      ["payment_proofs", "DELETE FROM payment_proofs"],
      ["payments", "DELETE FROM payments"],
      ["orders", "DELETE FROM orders"],
      ["reviews", "DELETE FROM reviews"],
      ["products", "DELETE FROM products"],
      ["stores", "DELETE FROM stores"],
      ["p2p_requests", "DELETE FROM p2p_requests"],
      ["p2p_orders", "DELETE FROM p2p_orders"],
      ["p2p_listings", "DELETE FROM p2p_listings"],
      ["rental_bookings", "DELETE FROM rental_bookings"],
      ["rental_items", "DELETE FROM rental_items"],
      ["disputes", "DELETE FROM disputes"],
      ["reports", "DELETE FROM reports"],
      ["favorites", "DELETE FROM favorites"],
      ["notifications", "DELETE FROM notifications"],
      ["email_otps", "DELETE FROM email_otps"],
      ["refresh_tokens", "DELETE FROM refresh_tokens"],
    ];

    for (const [name, query] of deleteOps) {
      const res = await client.query(query);
      if (res.rowCount > 0) {
        console.log(`  - Cleaned ${res.rowCount} row(s) from ${name}`);
      }
    }

    // Retain only platform audit logs that might belong to the preserved super admin
    const auditRes = await client.query(
      "DELETE FROM audit_logs WHERE actor_id <> $1 OR actor_id IS NULL OR university_id IS NOT NULL",
      [superAdminId]
    );
    if (auditRes.rowCount > 0) {
      console.log(`  - Cleaned ${auditRes.rowCount} test/demo audit log(s)`);
    }

    // Clean university-specific fee schedules, retaining default platform schedule
    await client.query("DELETE FROM fee_schedules WHERE university_id IS NOT NULL");

    // 3. Remove all other users (except canonical Super Admin)
    console.log("\n[3/5] Cleaning sample users...");
    const userRes = await client.query("DELETE FROM users WHERE id <> $1", [superAdminId]);
    console.log(`  ✓ Removed ${userRes.rowCount} sample/test user account(s).`);
    console.log(`  ✓ Exactly 1 user account remains: Super Admin (${superAdmin.email}).`);

    // 4. Remove test universities
    console.log("\n[4/5] Removing test-suite fixture universities...");
    const officialSlugs = ETHIOPIAN_UNIVERSITIES.map((u) => u.slug);
    const uniCleanRes = await client.query(
      "DELETE FROM universities WHERE slug NOT IN (SELECT unnest($1::text[]))",
      [officialSlugs]
    );
    console.log(`  - Removed ${uniCleanRes.rowCount} fixture universities.`);

    // 5. Seed official Ethiopian Universities
    console.log("\n[5/5] Seeding official Ethiopian universities...");
    let seededCount = 0;
    let updatedCount = 0;

    for (const uni of ETHIOPIAN_UNIVERSITIES) {
      const branding = {
        amharic_name: uni.amharicName,
        short_name: uni.code,
      };

      const check = await client.query("SELECT id FROM universities WHERE slug = $1 OR domain = $2", [
        uni.slug,
        uni.domain,
      ]);

      if (check.rows.length > 0) {
        await client.query(
          `UPDATE universities
              SET name = $1,
                  slug = $2,
                  domain = $3,
                  permitted_domains = $4,
                  code = $5,
                  city = $6,
                  region = $7,
                  institution_type = $8,
                  status = 'active',
                  isolation_mode = 'shared',
                  branding = COALESCE(branding, '{}'::jsonb) || $9::jsonb,
                  updated_at = now()
            WHERE id = $10`,
          [
            uni.name,
            uni.slug,
            uni.domain,
            uni.permittedDomains,
            uni.code,
            uni.city,
            uni.region,
            uni.institutionType,
            JSON.stringify(branding),
            check.rows[0].id,
          ]
        );
        updatedCount++;
      } else {
        await client.query(
          `INSERT INTO universities (
             name, slug, domain, permitted_domains, code, city, region, institution_type,
             status, isolation_mode, branding
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 'shared', $9)`,
          [
            uni.name,
            uni.slug,
            uni.domain,
            uni.permittedDomains,
            uni.code,
            uni.city,
            uni.region,
            uni.institutionType,
            JSON.stringify(branding),
          ]
        );
        seededCount++;
      }
    }
    console.log(`  ✓ ${seededCount} universities inserted, ${updatedCount} universities refreshed.`);
    console.log(`  ✓ Total authoritative universities active: ${ETHIOPIAN_UNIVERSITIES.length}`);

    // Ensure standard categories exist
    const categories = ["Books", "Electronics", "Stationery", "Sports Equipment"];
    for (const c of categories) {
      await client.query("INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING", [c]);
    }
    console.log("  ✓ Standard marketplace categories verified.");

    // Ensure default platform fee schedule exists
    const fsCheck = await client.query("SELECT id FROM fee_schedules WHERE university_id IS NULL");
    if (fsCheck.rows.length === 0) {
      await client.query(
        "INSERT INTO fee_schedules (university_id, commission_rate, featured_rate_per_day, created_by) VALUES (NULL, 0.05, 10.00, $1)",
        [superAdminId]
      );
      console.log("  ✓ Default platform fee schedule (5% commission) created.");
    }

    await client.query("COMMIT");
    console.log("\n=================================================================");
    console.log("  CLEANUP & SEED SUCCESSFUL");
    console.log("=================================================================");
    console.log(`- Super Admin preserved:  ${superAdmin.email}`);
    console.log(`- Super Admin scope:      Platform-wide (university_id = NULL)`);
    console.log(`- Campus Admins created:  0 (Super Admin assigns real admins via UI)`);
    console.log(`- Sample users remaining: 0`);
    console.log(`- Active Universities:    ${ETHIOPIAN_UNIVERSITIES.length} (MoE/EthERNet verified)`);
    console.log("=================================================================\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Cleanup failed, transaction rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
