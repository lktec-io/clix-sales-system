import AppRouter from './router/AppRouter';
import AuthProvider from './contexts/AuthContext';
import PlatformAuthProvider from './contexts/PlatformAuthContext';
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
          {/* Sibling to AuthProvider, not nested inside it — a completely
              independent auth state tree for the /platform/* route group
              (see PlatformProtectedRoute.jsx). Mounted globally like every
              other provider here since there's only one BrowserRouter/
              Routes tree (AppRouter.jsx) for platform routes to live in. */}
          <PlatformAuthProvider>
            <ToastProvider>
              <LanguageProvider>
                <CustomCursor />
                <AppRouter />
              </LanguageProvider>
            </ToastProvider>
          </PlatformAuthProvider>
        </AuthProvider>
      </CompanyProvider>
    </ThemeProvider>
  );
}

export default App;
