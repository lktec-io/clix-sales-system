import AppRouter from './router/AppRouter';
import AuthProvider from './contexts/AuthContext';
import PlatformAuthProvider from './contexts/PlatformAuthContext';
import CompanyProvider from './contexts/CompanyContext';
import ModuleProvider from './contexts/ModuleContext';
import ToastProvider from './contexts/ToastContext';
import ThemeProvider from './contexts/ThemeContext';
import LanguageProvider from './contexts/LanguageContext';
import CustomCursor from './components/common/CustomCursor';

function App() {
  return (
    <ThemeProvider>
      <CompanyProvider>
        <AuthProvider>
          {/* Nested inside AuthProvider (unlike PlatformAuthProvider below) —
              ModuleContext calls useAuth() to know when a tenant session
              exists, so it only fetches /modules/me once authenticated
              instead of firing a 401 on every public page. */}
          <ModuleProvider>
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
          </ModuleProvider>
        </AuthProvider>
      </CompanyProvider>
    </ThemeProvider>
  );
}

export default App;
