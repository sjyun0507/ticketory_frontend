import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import { useRoutes } from "react-router-dom";
import routes from "./router/router.jsx";

function App() {
    return (
        <div className="app">
            <Header/>
            <main className="content">
                {useRoutes(routes)}
            </main>
            <Footer/>
        </div>
    );
};
export default App;
