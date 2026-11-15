/* Local-only application guard: profiles are stored on this device and do not require login. */
import React from 'react';
import { Outlet } from 'react-router-dom';
const AuthGuard = () => <Outlet />;
export default AuthGuard;
