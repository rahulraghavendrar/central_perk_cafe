"use client";

import { createContext, useContext, useState } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);

  // Add or update an item in the cart
  const setCartItem = (item) => {
    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (cartItem) => cartItem.id === item.id
      );

      if (item.quantity <= 0) {
        return currentItems.filter(
          (cartItem) => cartItem.id !== item.id
        );
      }

      if (existingItem) {
        return currentItems.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, ...item }
            : cartItem
        );
      }

      return [...currentItems, item];
    });
  };

  // Replace/update one cart item with its latest options and quantity
const updateCartItem = (item) => {
  setCartItems((currentItems) => {
    const existingItem = currentItems.find(
      (cartItem) => cartItem.id === item.id
    )

    // If quantity becomes 0, remove the item
    if (item.quantity <= 0) {
      return currentItems.filter(
        (cartItem) => cartItem.id !== item.id
      )
    }

    // Update existing item
    if (existingItem) {
      return currentItems.map((cartItem) =>
        cartItem.id === item.id
          ? {
              ...cartItem,
              ...item,
            }
          : cartItem
      )
    }

    // Add new item
    return [
      ...currentItems,
      {
        ...item,
        quantity: item.quantity,
      },
    ]
  })
}

  // Increase quantity
  const increaseQuantity = (id) => {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  // Decrease quantity
  const decreaseQuantity = (id) => {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Remove item
  const removeFromCart = (id) => {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.id !== id)
    );
  };

  // Total number of items
  const itemCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  // Subtotal
  const subtotal = cartItems.reduce((total, item) => {
    const extrasTotal = (item.extras || []).reduce(
      (extraTotal, extra) =>
        extraTotal +
        Number(
          typeof extra === "object" ? extra.price || 0 : 0
        ),
      0
    );

    const itemPrice =
      Number(item.price || 0) + extrasTotal;

    return total + itemPrice * item.quantity;
  }, 0);

  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <CartContext.Provider
      value={{
      cartItems,
      setCartItem,
      updateCartItem,
      increaseQuantity,
      decreaseQuantity,
      removeFromCart,
      itemCount,
      subtotal,
      clearCart,
    }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
}