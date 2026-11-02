import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CreateWorkshop } from './pages/CreateWorkshop';
import { Join } from './pages/Join';
import { PresenterDashboard } from './pages/PresenterDashboard';
import { MainScreen } from './pages/MainScreen';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CreateWorkshop />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/present/:code" element={<PresenterDashboard />} />
        <Route path="/screen/:code" element={<MainScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
