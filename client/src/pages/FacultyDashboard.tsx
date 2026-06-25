// src/pages/FacultyDashboard.tsx
import { useAuth } from '@/contexts/AuthContext';

export default function FacultyDashboard() {
  const { currentUser, role } = useAuth();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Faculty Dashboard</h1>
      <p>Welcome {currentUser?.displayName || 'Faculty Member'}!</p>
      <div className="mt-4">
        {/* Faculty-specific content */}
      </div>
    </div>
  );
}