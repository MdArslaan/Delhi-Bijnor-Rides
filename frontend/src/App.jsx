import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import BookRide from './pages/BookRide';
import Dashboard from './pages/Dashboard';
import MyRides from './pages/MyRides';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Passenger Routes */}
        <Route path="/book" element={
          <ProtectedRoute allowedRoles={['Passenger']}>
            <BookRide />
          </ProtectedRoute>
        } />
        
        {/* Protected Driver Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['Driver']}>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        {/* Protected Shared Routes */}
        <Route path="/my-rides" element={
          <ProtectedRoute allowedRoles={['Passenger', 'Driver']}>
            <MyRides />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
