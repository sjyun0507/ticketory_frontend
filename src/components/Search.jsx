import {useEffect, useMemo, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {searchMovies} from "../api/movieApi.js";

function useQueryParam(name) {
    const {search} = useLocation();
    return useMemo(() => new URLSearchParams(search).get(name) || "", [search, name]);
}
const Search = () => {
    const navigate = useNavigate();
    const qParam = useQueryParam('q');
    const [q, setQ] = useState(qParam);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // URL q 변경되면 입력 동기화 + 검색
    useEffect(() => {
        setQ(qParam);
        if (qParam) {
            (async () => {
                setLoading(true);
                try {
                    const data = await searchMovies(qParam); // [{id,title,posterUrl,...}]
                    setResults(data || []);
                } finally {
                    setLoading(false);
                }
            })();
        } else {
            setResults([]);
        }
    }, [qParam]);

    const handleSearch = (e) => {
        e.preventDefault();
        const next = q.trim();
        navigate(`/search${next ? `?q=${encodeURIComponent(next)}` : ""}`);
    }

    return (
        <main className="max-w-[1200px] mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-4">영화 검색</h1>

            <form onSubmit={handleSearch} className="flex gap-2 mb-6" role="search" aria-label="영화 검색">
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="영화 제목을 입력하세요"
                    className="flex-1 border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                />
                <button className="px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 ">
                    검색
                </button>
            </form>

            {loading && <div>검색 중…</div>}
            {!loading && qParam && results.length === 0 && (
                <div className="text-gray-500">검색 결과가 없습니다.</div>
            )}

            <ul className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.map((m) => (
                    <li key={m.id} className="border rounded-md overflow-hidden hover:shadow">
                        <button
                            onClick={() => navigate(`/movies/${m.id}`)}
                            className="text-left w-full"
                            aria-label={`${m.title} 상세로 이동`}
                        >
                            <img src={m.posterUrl} alt={m.title} className="w-full aspect-[2/3] object-cover" />
                            <div className="p-3">
                                <div className="font-semibold truncate">{m.title}</div>
                                {m.releaseDate && (
                                    <div className="text-sm text-gray-500">{m.releaseDate}</div>
                                )}
                            </div>
                        </button>
                    </li>
                ))}
            </ul>
        </main>
    );
}

export default Search;