const router = require("express").Router();
const auth = require("../middleware/auth");
const { canCreateGroup, canJoinGroup } = require("../middleware/planGate");
const Group = require("../models/group");
const Membership = require("../models/Membership");
const Message = require("../models/Message");
const Plans = require("../models/Plan");

// Helper function to generate 6-digit room code
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// POST /api/groups - Create new group
router.post("/", auth, canCreateGroup, async (req, res) => {
  const { name, description, isPrivate } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Group name is required." });
  }

  try {
    const ownerPlan = Plans[req.user.plan] || Plans["free"];

    const newGroup = new Group({
      name,
      description,
      owner: req.user.id,
      isPrivate: isPrivate || false,
      roomCode: isPrivate ? generateRoomCode() : null, // Generate 6-digit code for private rooms
      memberCount: 1, // ✅ default
      limits: { maxMembers: ownerPlan.maxMembersPerGroup },
    });

    await newGroup.save();

    await Membership.create({
      user: req.user.id,
      group: newGroup._id,
      role: "owner",
    });

    res
      .status(201)
      .json({ message: "Group created successfully.", group: newGroup });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ error: "Server error creating group." });
  }
});

// GET /api/groups
router.get("/", auth, async (req, res) => {
  try {
    const publicGroups = await Group.find({ isPrivate: false }).populate(
      "owner",
      "name avatarUrl"
    );
    const userMemberships = await Membership.find({
      user: req.user.id,
    }).populate("group");
    const privateGroupsUserIsIn = userMemberships
      .map((m) => m.group)
      .filter((g) => g?.isPrivate);

    const allRelevantGroups = [...publicGroups, ...privateGroupsUserIsIn].filter(
      (group, index, self) =>
        index === self.findIndex((g) => g._id.toString() === group._id.toString())
    );

    res.json(allRelevantGroups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ error: "Server error fetching groups." });
  }
});

// POST /api/groups/join-by-code - Join private room using 6-digit code
router.post("/join-by-code", auth, canJoinGroup, async (req, res) => {
  const { roomCode } = req.body;

  if (!roomCode || roomCode.length !== 6) {
    return res.status(400).json({ error: "Invalid room code. Code must be 6 digits." });
  }

  try {
    const group = await Group.findOne({ roomCode, isPrivate: true });
    if (!group) {
      return res.status(404).json({ error: "Room code not found or room is not private." });
    }

    const existingMembership = await Membership.findOne({
      user: req.user.id,
      group: group._id,
    });
    if (existingMembership) {
      return res.status(409).json({ error: "Already a member of this room." });
    }

    const ownerPlan = Plans[group.owner?.plan || "free"];
    if (
      group.memberCount >=
      (group.limits?.maxMembers || ownerPlan.maxMembersPerGroup)
    ) {
      return res
        .status(403)
        .json({ error: "Room has reached its maximum member limit." });
    }

    await Membership.create({ user: req.user.id, group: group._id, role: "member" });
    group.memberCount += 1;
    await group.save();

    res.json({ message: "Successfully joined the room.", groupId: group._id });
  } catch (error) {
    console.error("Error joining by code:", error);
    res.status(500).json({ error: "Server error joining room." });
  }
});

// POST /api/groups/:id/join
router.post("/:id/join", auth, canJoinGroup, async (req, res) => {
  const groupId = req.params.id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    const existingMembership = await Membership.findOne({
      user: req.user.id,
      group: groupId,
    });
    if (existingMembership) {
      return res.status(409).json({ error: "Already a member." });
    }

    const ownerPlan = Plans[group.owner?.plan || "free"];
    if (
      group.memberCount >=
      (group.limits?.maxMembers || ownerPlan.maxMembersPerGroup)
    ) {
      return res
        .status(403)
        .json({ error: "Group has reached its maximum member limit." });
    }

    await Membership.create({ user: req.user.id, group: groupId, role: "member" });
    group.memberCount += 1;
    await group.save();

    res.json({ message: "Successfully joined the group." });
  } catch (error) {
    console.error("Error joining group:", error);
    res.status(500).json({ error: "Server error joining group." });
  }
});

// GET /api/groups/:id/members - Get group members
router.get("/:id/members", auth, async (req, res) => {
  try {
    const members = await Membership.find({ group: req.params.id }).populate("user", "name email _id");
    res.json(members);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: "Server error." });
  }
});

// DELETE /api/groups/:groupId/members/:userId - Remove member from group
router.delete("/:groupId/members/:userId", auth, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found." });

    // Only owner can remove members
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only owner can remove members." });
    }

    const membership = await Membership.findOneAndDelete({ user: userId, group: groupId });
    if (!membership) return res.status(404).json({ error: "Member not found." });

    group.memberCount = Math.max(0, group.memberCount - 1);
    await group.save();

    res.json({ message: "Member removed successfully." });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ error: "Server error." });
  }
});

// POST /api/groups/:groupId/members/:userId - Add member to group (admin)
router.post("/:groupId/members/:userId", auth, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found." });

    // Only owner can add members
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only owner can add members." });
    }

    const existingMembership = await Membership.findOne({ user: userId, group: groupId });
    if (existingMembership) return res.status(409).json({ error: "User already in group." });

    await Membership.create({ user: userId, group: groupId, role: "member" });
    group.memberCount += 1;
    await group.save();

    res.json({ message: "Member added successfully." });
  } catch (error) {
    console.error("Error adding member:", error);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
