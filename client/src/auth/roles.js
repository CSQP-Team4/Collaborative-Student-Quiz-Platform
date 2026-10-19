// The three roles from CSQP-F-003, and where each one lands after login.
export const ROLES = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
  ADMIN: 'admin',
};

export const ROLE_HOME = {
  [ROLES.STUDENT]: '/student',
  [ROLES.INSTRUCTOR]: '/instructor',
  [ROLES.ADMIN]: '/admin',
};

export const ROLE_LABEL = {
  [ROLES.STUDENT]: 'Student',
  [ROLES.INSTRUCTOR]: 'Instructor',
  [ROLES.ADMIN]: 'Admin',
};

export function homeFor(user) {
  return (user && ROLE_HOME[user.role]) || '/login';
}
