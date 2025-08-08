import { RouterProvider } from "react-router-dom"
import { lazy, Suspense } from "react"
import { Toaster } from "sonner"
import { router } from "./router"

const Updater = lazy(() => import("./components/updater"))

function App(): JSX.Element {
  return (
    <>
      <RouterProvider router={router}></RouterProvider>

      <Suspense>
        <Updater />
      </Suspense>

      <Toaster />
    </>
  )
}

export default App
