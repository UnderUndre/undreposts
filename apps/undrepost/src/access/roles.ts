import type { Access, FieldAccess } from 'payload'

/**
 * Admin = Member whose server-side resolved roles include 'admin'.
 * Roles are NEVER derived from IdP claims (members.contract.md) — they are set
 * by JIT provisioning from the `sub` allowlist and managed in the admin panel.
 */
const hasRole = (user: { roles?: null | string[] } | null | undefined, role: string): boolean =>
  Array.isArray(user?.roles) && user.roles.includes(role)

export const isAdmin: Access = ({ req }) => hasRole(req.user, 'admin')

export const isAdminFieldLevel: FieldAccess = ({ req }) => hasRole(req.user, 'admin')

/**
 * Authors may modify their own docs; admins may modify everything.
 * `author` is the canonical ownership field on Posts/Comments.
 */
export const isAdminOrAuthor: Access = ({ req }) => {
  if (!req.user) {
    return false
  }
  if (hasRole(req.user, 'admin')) {
    return true
  }
  return {
    author: {
      equals: req.user.id,
    },
  }
}
