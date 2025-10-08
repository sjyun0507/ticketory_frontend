## 데모 (Live Demo)
👉 [Ticketory 바로가기](http://211.188.58.155:8080/)  

---
# Ticketory - Ticket + Story

영화 예매와 감상 스토리 공유를 결합한 **영화 플랫폼 웹 애플리케이션**입니다. React 기반의 직관적 UI와 Spring Boot 백엔드로 구성되어 있습니다.
사용자는 실시간 좌석 선택, 예매, 결제, QR 티켓 발급까지 한 번에 진행할 수 있으며,관람 후에는 감상 스토리를 업로드해 커뮤니티처럼 소통할 수 있습니다.  

---

## Key Features

- **영화 조회 및 상세 정보** – 예고편, 평점, 상영 정보 확인  
- **실시간 좌석 예매 시스템** – HOLD/BOOKED 좌석 분리 관리  
- **결제 및 티켓 발급** – QR 코드 자동 생성 및 예매 내역 확인  
- **마이페이지** – 회원정보 수정, 예매 내역, 취소/환불 기능  
- **관리자 기능** – 영화 등록/삭제, 상영시간표 및 예매 관리  
- **스토리 피드** – 관람 후 감상글 업로드 및 공유  

---

## 주요 기능 화면

<table>
  <tr>
    <td width="50%" valign="top">
      <b>메인 페이지</b><br/>
      <sub>실시간 상영 영화 목록과 예매 바로가기</sub><br/><br/>
      <img alt="메인 페이지" src="https://github.com/user-attachments/assets/4c69e2ba-f6c2-404b-8217-c8f42dcfdb2b" width="100%"/>
    </td>
    <td width="50%" valign="top">
      <b>영화 상세보기</b><br/>
      <sub>예고편, 출연진, 상영관 정보 및 빠른 예매</sub><br/><br/>
      <img alt="영화 상세보기" src="https://github.com/user-attachments/assets/3b059e38-9587-4339-8273-68e41e18d32a" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <b>영화 예매</b><br/>
      <sub>날짜별 상영 시간표 조회 및 예매 진행</sub><br/><br/>
      <img alt="영화 예매" src="https://github.com/user-attachments/assets/3baff37f-8b1a-43ac-b9a9-8dc519498ccd" width="100%"/>
    </td>
    <td width="50%" valign="top">
      <b>좌석 예매</b><br/>
      <sub>실시간 좌석 상태(HOLD/BOOKED) 반영</sub><br/><br/>
      <img alt="좌석 예매" src="https://github.com/user-attachments/assets/d17b63db-b3da-47d9-9d96-7dbb9408d530" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <b>이벤트 / 공지 게시판</b><br/>
      <sub>영화관 이벤트 및 공지사항 관리</sub><br/><br/>
      <img alt="이벤트/공지 게시판" src="https://github.com/user-attachments/assets/4237168c-5b2d-4368-9289-d366e018dc47" width="100%"/>
    </td>
    <td width="50%" valign="top">
      <b>스토리 피드</b><br/>
      <sub>관람 후 감상 스토리 업로드 및 공유</sub><br/><br/>
      <img alt="스토리 피드" src="https://github.com/user-attachments/assets/19bdba85-5d19-4228-9096-d550a06195a3" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <b>마이페이지</b><br/>
      <sub>회원정보 수정, 예매내역 확인 및 QR 티켓 조회</sub><br/><br/>
      <img alt="마이페이지" src="https://github.com/user-attachments/assets/5b04fc87-e762-446a-935e-34b5b45bf2ca" width="100%"/>
    </td>
    <td width="50%" valign="top">
      <b>관리자 대시보드</b><br/>
      <sub>매출 통계, 상영 일정, 게시판 관리</sub><br/><br/>
      <img alt="관리자 대시보드" src="https://github.com/user-attachments/assets/1f757295-1cb7-41ab-8aad-5478be12cffe" width="100%"/>
    </td>
  </tr>
</table>

---
##  Tech Stack

**Frontend:** React + Vite + Zustand + TailwindCSS + Axios + React Router  
**Backend:** Spring Boot + JPA + MariaDB + Spring Security (JWT)  
**Deployment:** Naver Cloud 

---

## 시연 영상 (Demo Video)
- 예매 흐름 (영화 → 상영시간 → 좌석 → 결제 → QR 티켓)
👉 [예매흐름 시연영상(mp4)](https://github.com/user-attachments/assets/099c75e4-6254-4c2b-84b9-2d4b7cf5523c)

- 관리자 영화 추가 흐름 (관리자 → 영화관리 → 새 영화 추가 → 미디어 추가 → 홈)
👉 [관리자흐름 시연영상(mp4)](https://github.com/user-attachments/assets/b60a7af4-1f1d-457d-9535-ce3da64a18c4)

---

### 발표 자료 (Presentation) 
👉 [프로젝트 발표자료 (PDF)](https://github.com/user-attachments/files/22225340/ticketory_presentation_final.pdf)

---

## 🔗 Backend Repository

<a href="https://github.com/sjyun0507/Ticketory.git" target="_blank">
  <img src="https://img.shields.io/badge/-%20Go%20to%20Backend%20Repo-2E8B57?style=for-the-badge&logo=springboot&logoColor=white" />
</a>



