import AppRouter from './router/AppRouter';
import AuthProvider from './contexts/AuthContext';
import CompanyProvider from './contexts/CompanyContext';
import ToastProvider from './contexts/ToastContext';
import ThemeProvider from './contexts/ThemeContext';
import LanguageProvider from './contexts/LanguageContext';
import CustomCursor from './components/common/CustomCursor';

function App() {
  return (
    <ThemeProvider>
      <CompanyProvider>
        <AuthProvider>
          <ToastProvider>
            <LanguageProvider>
              <CustomCursor />
              <AppRouter />
            </LanguageProvider>
          </ToastProvider>
        </AuthProvider>
      </CompanyProvider>
    </ThemeProvider>
  );
}

export default App;
