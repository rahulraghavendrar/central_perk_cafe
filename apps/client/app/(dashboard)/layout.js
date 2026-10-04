import Navbar from '@/app/components/Navbar'
import { CartProvider } from '@/app/components/CartContext'

export default function DashboardLayout({ children }) {
  return (
    <CartProvider>
      <Navbar />
      <main className="dashboard-content">
        {children}
      </main>
    </CartProvider>
  )
}