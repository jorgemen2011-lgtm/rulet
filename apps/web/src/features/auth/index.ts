/**
 * API pública de la feature de autenticación. Las pantallas de `src/app` importan SOLO de aquí.
 *
 * Modelo de seguridad en web: la sesión vive en cookies httpOnly emitidas por la API; el JavaScript de la
 * página nunca ve los tokens. Todo lo que hay en esta feature es UX: la autorización la decide la API.
 */
export { AccountPanel } from './components/AccountPanel';
export { AuthNav } from './components/AuthNav';
export { AuthProvider } from './components/AuthProvider';
export { LoginForm } from './components/LoginForm';
export type { LoginFormProps } from './components/LoginForm';
export { RegisterForm } from './components/RegisterForm';
export type { RegisterFormProps } from './components/RegisterForm';
export { RequireAuth } from './components/RequireAuth';
export { useAuth } from './hooks/use-auth';
export type { AuthContextValue, AuthState, AuthStatus } from './auth-context';
