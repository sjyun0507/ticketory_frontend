import Home from "../pages/public/Home.jsx";
import Signup from "../pages/member/Signup.jsx";
import Login from "../pages/member/Login.jsx";
import KakaoRedirectHandler from "../pages/member/KakaoRedirectHandler.jsx";
import MyPage from "../pages/mypage/MyPage.jsx";
import MyBookings from "../pages/mypage/MyBookings.jsx";
import Booking from "../pages/public/Booking.jsx";
import Screenings from "../pages/public/Screenings.jsx";
import Story from "../pages/public/Story.jsx";
import Points from "../pages/public/Points.jsx";
import Events from "../pages/public/Events.jsx";
import RequireAuth from "./RequireAuth.jsx";
import Settings from "../pages/mypage/Settings.jsx";
import MovieDetail from "../pages/public/MovieDetail.jsx";
import Seat from "../pages/Seat.jsx";
import Search from "../components/Search.jsx";
import Payment from "../pages/Payment.jsx";
import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
import AdminBookings from "../pages/admin/AdminBookings.jsx";
import AdminMovies from "../pages/admin/AdminMovies.jsx";
import AdminStats from "../pages/admin/AdminStats.jsx";
import AdminLayout from "../components/AdminLayout.jsx";
import AdminScreenings from "../pages/admin/AdminScreenings.jsx";

const routes = [
    {path: "/", element: <Home/>},
    {path: "/search", element: <Search/>},
    {path: '/movies/:id', element: <MovieDetail /> },
    {path: "/booking", element: <Booking/>},
    {path: "/screenings", element: <Screenings/>},
    {path: "/payment", element: <Payment />},
    {
        path: "/seat",
        element: <RequireAuth/>,
        children: [
            { index: true, element: <Seat /> },
        ],
    },
    {path: "/story", element: <Story/>},
    {path: "/events", element: <Events/>},
    {path: "/points", element: <Points/>},
    {path: "/signup", element: <Signup/>},
    {path: "/login", element: <Login/>},
    {path: "/kakao", element: <KakaoRedirectHandler/>},
    {
        path: "/mypage",
        element: <RequireAuth/>,
        children: [
            { index: true, element: <MyPage /> },
            { path: "bookings", element: <MyBookings /> },
            { path: "settings", element: <Settings /> },
        ],
    },
    {
        path: "/admin",
        element: <RequireAuth><AdminLayout/></RequireAuth>,
        children: [
            { index: true, element: <AdminDashboard /> },
            { path: "bookings", element: <AdminBookings /> },
            { path: "screenings", element: <AdminScreenings /> },
            { path: "movies", element: <AdminMovies /> },
            { path: "stats", element: <AdminStats /> },
        ],
    },
];

export default routes;