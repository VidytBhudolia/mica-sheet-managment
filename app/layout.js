import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Nexus B2B System',
  description: 'B2B Sales and Inventory Management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
