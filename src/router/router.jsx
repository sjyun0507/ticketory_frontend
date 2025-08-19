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

const routes = [
    {path: "/", element: <Home/>},
    {path: '/movies/:id', element: <MovieDetail /> },
    {path: "/booking", element: <Booking/>},
    {path: "/screenings", element: <Screenings/>},
    {path: "/seat", element: <Seat />},
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
    }
];

export default routes;