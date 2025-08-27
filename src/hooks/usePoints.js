import { useQuery } from "@tanstack/react-query";
import { getMemberPoints } from "../api/memberApi"; // 기존 memberApi의 함수 사용

export const useMemberPoints = ({ memberId, page, size, type, from, to }) => {
    return useQuery({
        queryKey: ["member-points", memberId, page, size, type, from, to],
        queryFn: () => getMemberPoints({ memberId, page, size, type, from, to }),
        enabled: !!memberId,
        staleTime: 1000 * 30,
    });
};