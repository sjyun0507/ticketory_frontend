import React from "react";
import { Link } from "react-router-dom";
import defaultPoster from '../../assets/styles/OmniscientReader_pster.jpg';

const MyBookings = () => {
  const bookings = [
    {
      id: 1,
      movieTitle: "전지적 독자시점",
      bookingDate: "2024-06-15",
      theaterName: "TICKETORY 1관",
      seatInfo: "A12, A13",
      posterUrl: defaultPoster,
    },
    {
      id: 2,
      movieTitle: "전지적 독자시점",
      bookingDate: "2024-06-20",
      theaterName: "TICKETORY VIP관",
      seatInfo: "B5, B6",
      posterUrl: defaultPoster,
    },
  ];

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="mb-4">
        <Link
          to="/mypage"
          className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded border"
        >
          ← 마이페이지로
        </Link>
      </div>
      <h2>나의 예매 내역</h2>
      {bookings.length === 0 ? (
        <p>예매 내역이 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
          {bookings.map(({ id, movieTitle, bookingDate, theaterName, seatInfo, posterUrl }) => (
            <div
              key={id}
              style={{
                display: "flex",
                gap: "20px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "10px",
                alignItems: "center",
              }}
            >
              <img
                src={posterUrl}
                alt={movieTitle}
                style={{ width: "100px", height: "150px", objectFit: "cover", borderRadius: "4px" }}
              />
              <div>
                <h3 style={{ margin: "0 0 10px 0" }}>{movieTitle}</h3>
                <p style={{ margin: "4px 0" }}>
                  <strong>상영관:</strong> {theaterName}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>예매일:</strong> {bookingDate}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>좌석:</strong> {seatInfo}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default MyBookings;
