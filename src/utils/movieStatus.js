export function computeMovieStatus(movie) {
    // 규칙: 관리자 status === true면 무조건 NOW_SHOWING
    // 아니면 releaseDate 기준으로 COMING_SOON / FINISHED 자동 분기
    if (movie?.status === true) return "NOW_SHOWING";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rd = movie?.releaseDate ? new Date(movie.releaseDate) : null;
    if (!rd || isNaN(rd)) return "UNKNOWN";
    rd.setHours(0, 0, 0, 0);

    if (rd > today) return "COMING_SOON";   // 개봉 예정 (미래)
    if (rd <= today) return "FINISHED";     // 상영 종료(또는 아직 미수동 전환)
    return "UNKNOWN";
}
