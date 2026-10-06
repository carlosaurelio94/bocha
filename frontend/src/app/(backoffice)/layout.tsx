import { AppShell } from '@/components/layout/AppShell';
import { PermissionsProvider } from '@/context/PermissionsContext';
import { CompanyProvider } from '@/context/CompanyContext';

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyProvider>
      <PermissionsProvider>
        <AppShell>{children}</AppShell>
      </PermissionsProvider>
    </CompanyProvider>
  );
}
