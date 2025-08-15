import Home from "../pages/menu/Home.jsx";
import Signup from "../pages/member/Signup.jsx";
import Login from "../pages/member/Login.jsx";
import KakaoRedirectHandler from "../pages/member/KakaoRedirectHandler.jsx";
import MyPage from "../pages/mypage/MyPage.jsx";
import MyBookings from "../pages/mypage/MyBookings.jsx";
import Booking from "../pages/menu/Booking.jsx";
import Screenings from "../pages/menu/Screenings.jsx";
import Story from "../pages/menu/Story.jsx";
import Points from "../pages/menu/Points.jsx";
import Events from "../pages/menu/Events.jsx";
import RequireAuth from "./RequireAuth.jsx";

const routes = [
    {path: "/", element: <Home/>},
    {path: "/booking", element: <Booking/>},
    {path: "/screenings", element: <Screenings/>},
    {path: "/story", element: <Story/>},
    {path: "/events", element: <Events/>},
    {path: "/points", element: <Points/>},
    {path: "/signup", element: <Signup/>},
    {path: "/login", element: <Login/>},
    {path: "/kakao", element: <KakaoRedirectHandler/>},
    {
        element: <RequireAuth/>,           // 보호 필요, 실시간 토큰 확인
        children: [
            { path: "/mypage", element: <MyPage /> },            // MyPage 단독
            { path: "/mypage/bookings", element: <MyBookings /> } // 예매내역 단독
        ],
    },
];

export default routes;