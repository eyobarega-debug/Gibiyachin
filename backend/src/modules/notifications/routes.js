const express = require("express");
const db = require("../../db");
const { requireAuth } = require("../../middleware/auth");
const { asyncHandler, notFound, forbidden } = require("../../utils/errors");

const router = express.Router();

router.get(
  "/",
  requireAuth(),
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unreadOnly === "true";
    const { rows } = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ${unreadOnly ? "AND read_at IS NULL" : ""}
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = await db.query("SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read_at IS NULL", [req.user.id]);
    const notifications = rows.map((r) => ({
      ...r,
      targetRoute: r.target_route,
      targetEntityType: r.target_entity_type,
      targetEntityId: r.target_entity_id,
      target: {
        route: r.target_route,
        entityType: r.target_entity_type,
        entityId: r.target_entity_id,
      },
    }));
    res.json({ notifications, unreadCount: Number(unread.rows[0].count) });
  })
);

router.patch(
  "/:id/read",
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `UPDATE notifications
          SET read_at = COALESCE(read_at, now())
        WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) throw notFound("Notification not found");
    const unread = await db.query("SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read_at IS NULL", [req.user.id]);
    const notification = rows[0];
    res.json({
      success: true,
      notification: {
        ...notification,
        targetRoute: notification.target_route,
        targetEntityType: notification.target_entity_type,
        targetEntityId: notification.target_entity_id,
        target: {
          route: notification.target_route,
          entityType: notification.target_entity_type,
          entityId: notification.target_entity_id,
        },
      },
      unreadCount: Number(unread.rows[0].count),
    });
  })
);

router.post(
  "/read-all",
  requireAuth(),
  asyncHandler(async (req, res) => {
    await db.query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [req.user.id]);
    res.json({ success: true, unreadCount: 0 });
  })
);

module.exports = router;
