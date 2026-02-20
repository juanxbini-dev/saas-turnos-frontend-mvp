import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';

function App() {
  return (
    <ErrorBoundary>
      <ToastContainer />
      <AppProvider>
        <AuthProvider>
          <Router>
            <div className="App">
              <AppRouter />
            </div>
          </Router>
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
