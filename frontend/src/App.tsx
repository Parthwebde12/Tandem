import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Home from "./pages/Home";
import ItemDetail from "./pages/ItemDetail";
import Items from "./pages/Items";
import Login from "./pages/Login";
import Preview from "./pages/Preview";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Preview />} />
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/workspace" element={<Home />} />
          <Route path="/items" element={<Items />} />
          <Route path="/items/:itemId" element={<ItemDetail />} />
        </Route>
      </Route>
    </Routes>
  );
}