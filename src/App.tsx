import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ErrorReporterProvider } from './context/ErrorReporterContext';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorReportModal from './components/ErrorReportModal';
import ToastContainer from './components/ToastContainer';

function App() {
  return (
    <ErrorBoundary>
      <ErrorReporterProvider>
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
        <ErrorReportModal />
      </ErrorReporterProvider>
    </ErrorBoundary>
  );
}

export default App;
