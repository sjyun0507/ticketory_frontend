import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import MovieList from "../../components/MovieList";
import {useMovieList} from "../../hooks/useMovies";
import {computeMovieStatus} from "../../utils/movieStatus.js";

/*메인 홈
* 전체 영화 리스트 노출 (현재상영작/개봉예정작/상영종료 필터)
* 빠른 예매하기 흐름
*/

const TABS = [
    { key: "now",      label: "현재상영작", match: (m) => computeMovieStatus(m) === "NOW_SHOWING" },
    { key: "soon",     label: "개봉예정작", match: (m) => computeMovieStatus(m) === "COMING_SOON" },
    { key: "finished", label: "상영종료",   match: (m) => computeMovieStatus(m) === "FINISHED" },
];

export default function Home() {
    const [params, setParams] = useSearchParams();
    const activeKey = params.get("tab") || "now";
    const activeTab = TABS.find(t => t.key === activeKey) || TABS[0];

    const { data: pageData, isLoading: pending, error } = useMovieList({ page: 0, size: 24 });

    // 페이지네이션/배열 응답 모두 대응
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const allMovies = pageData?.content ?? pageData ?? [];

    const visibleMovies = useMemo(
        () => (Array.isArray(allMovies) ? allMovies.filter(activeTab.match) : []),
        [allMovies, activeTab]
    );

    return (
        <main className="mx-auto max-w-[1200px] px-4 py-6">
            {/* 탭 */}
            <div className="mb-4 inline-flex rounded-2xl bg-gray-100 p-1">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setParams({ tab: t.key })}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${activeKey===t.key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
                        aria-pressed={activeKey===t.key}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* 리스트 */}
            {pending ? (
                <div className="py-10 text-center text-gray-500">로딩 중…</div>
            ) : error ? (
                <div className="py-10 text-center text-rose-500">불러오기 실패</div>
            ) : visibleMovies.length === 0 ? (
                <div className="py-10 text-center text-gray-400">표시할 영화가 없습니다.</div>
            ) : (
                <MovieList movies={visibleMovies} />
            )}
        </main>
    );
}