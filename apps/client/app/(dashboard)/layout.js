import Navbar from '@/app/components/Navbar'
import OrderTracker from '@/app/components/OrderTracker'
import { CartProvider } from '@/app/components/CartContext'

export default function DashboardLayout({ children }) {
  return (
    <CartProvider>
      <Navbar />
      <main className="dashboard-content">
        {children}
      </main>
      <OrderTracker />
    </CartProvider>
  )
}