import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Mica Sheet',
  description: 'Mica Sheet Sales Managment',
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
