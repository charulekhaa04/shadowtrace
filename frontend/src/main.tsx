import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111B2B',
            color: '#E8EEF7',
            border: '1px solid #243550',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#35C98A',
              secondary: '#111B2B',
            },
          },
          error: {
            iconTheme: {
              primary: '#FF4757',
              secondary: '#111B2B',
            },
          },
          duration: 4000,
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
