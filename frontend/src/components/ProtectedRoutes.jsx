import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const userData = localStorage.getItem("user");

  if (!userData) {
    return <Navigate to="/" replace />;
  }

  let user;
  try {
    user = JSON.parse(userData);
  } catch {
    localStorage.removeItem("user");
    return <Navigate to="/" replace />;
  }

  if (!user?.role) {
    localStorage.removeItem("user");
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
