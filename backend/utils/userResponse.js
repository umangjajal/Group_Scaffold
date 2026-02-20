function toUserResponse(user) {
  return {
    id: user._id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    plan: user.plan,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    status: user.status,
    gender: user.gender,
    createdAt: user.createdAt,
  };
}

module.exports = { toUserResponse };
