import Home from "./pages/Home.jsx";
import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import KakaoRedirectHandler from "./pages/KakaoRedirectHandler.jsx";

const routes = [
    { path: "/", element: <Home /> },
    { path: "/signup", element: <Signup /> },
    { path: "/login", element: <Login /> },
    { path: "/kakao",element: <KakaoRedirectHandler />}
];

export default routes;