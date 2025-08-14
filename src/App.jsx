import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import {Route, Routes} from "react-router-dom";
import routes from "./router.jsx";
import './App.css';

function App() {
    return (
        <div className="app">
            <Header/>
            <main className="content">
                <Routes>
                    {routes.map((r, i) => (
                        <Route key={i} path={r.path} element={r.element} />
                    ))}
                </Routes>
            </main>
            <Footer/>
        </div>
    );
};
export default App
