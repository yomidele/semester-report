// Keep extensionless imports pointed at the shared provider implementation.
// The .ts/.tsx duplicates previously caused the root route to receive an
// undefined AuthProvider during SSR.
export { AuthProvider, useAuthSession } from "./use-auth.tsx";
