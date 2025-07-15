import { useState, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import * as XLSX from "xlsx";

export default function PaperSwiper() {
  const [fileList] = useState([
    "dbpia_data_new.xlsx",
    "dbpia_info_new.xlsx",
    "kci_data_new.xlsx",
    "kci_info_new.xlsx",
    "riss_data_new.xlsx",
    "riss_info_new.xlsx",
  ]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [papers, setPapers] = useState([]);
  const [index, setIndex] = useState(0);
  const [keepList, setKeepList] = useState([]);
  const [dropList, setDropList] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [disableDrag, setDisableDrag] = useState(false);
  const [manualAnimating, setManualAnimating] = useState(false);
  const [pendingDecision, setPendingDecision] = useState(null);

  const history = useRef([]);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-25, 0, 25]);
  const borderColor = useTransform(
    x,
    [-150, 0, 150],
    ["#dc2626", "#cccccc", "#16a34a"]
  );
  const bgColor = useTransform(
    x,
    [-150, 0, 150],
    ["#fecaca", "#f3f4f6", "#bbf7d0"]
  );
  const opacityKeep = useTransform(x, [50, 150], [0, 1]);
  const opacityDrop = useTransform(x, [-150, -50], [1, 0]);

  const currentPaper = papers[index];
  const nextPaper = papers[index + 1];

  const parseAbstract = (text) => text.replace(/<BR\s*\/?\>/gi, "\n");

  const loadXLSX = (filename) => {
    fetch(`/papers/${filename}`)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // 1. 헤더 포함 전체 배열로 불러오기
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // 2. 첫 행은 칼럼명
        const headers = rows[0];
        const dataRows = rows.slice(1);

        // 3. 각 행을 객체로 변환하면서 index는 row[0], 나머지는 열 이름으로
        const parsed = dataRows.map((row) => {
          const rowObj = {};
          headers.forEach((header, i) => {
            rowObj[header] = row[i];
          });

          return {
            index: row[0] ?? null, // A열 (숫자 기준 인덱스)
            title:
              rowObj["논문제목"] ||
              rowObj["논문명"] ||
              rowObj["제목"] ||
              "제목 없음",
            abstract: parseAbstract(
              rowObj["초록"] || rowObj["국문 초록 (Abstract)"] || "초록 없음"
            ),
            journal: rowObj["저널명"] || rowObj["학술지명"] || "",
          };
        });

        const saved = JSON.parse(localStorage.getItem(filename) || "{}");
        setSelectedFile(filename);
        setPapers(parsed);
        setIndex(saved.index || 0);
        setKeepList(saved.keepList || []);
        setDropList(saved.dropList || []);
        history.current = saved.history || [];
      });
  };

  const saveProgress = () => {
    if (!selectedFile) return;
    const data = { index, keepList, dropList, history: history.current };
    localStorage.setItem(selectedFile, JSON.stringify(data));
  };

  const exportCSVPerFile = (file) => {
    const saved = JSON.parse(localStorage.getItem(file) || "{}");
    const history = saved.history || [];

    const combined = history.map((entry, i) => ({
      index: entry.paper.index ?? 0,
      title: entry.paper.title,
      label: entry.decision === "keep" ? 1 : 0,
    }));

    const csv = [
      "index,title,label",
      ...combined.map(
        (r) => `${r.index},"${r.title.replace(/"/g, '""')}",${r.label}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=cp949;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${file.replace(/\.xlsx$/, "")}_result.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    saveProgress();
  }, [index, keepList, dropList]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight") animateDecision("keep");
      else if (e.key === "ArrowLeft") animateDecision("drop");
      else if (e.key === "ArrowDown") handleUndo();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentPaper]);

  const animateDecision = (decision) => {
    const toX = decision === "keep" ? 300 : -300;
    const toRotate = decision === "keep" ? 25 : -25;

    setManualAnimating(true); // exit 비활성화 유도

    const step = 60;
    const duration = 220;
    const interval = duration / (Math.abs(toX) / step);
    let currentX = 0;
    let currentRotate = 0;

    const id = setInterval(() => {
      currentX += decision === "keep" ? step : -step;
      currentRotate += decision === "keep" ? 0.6 : -0.6;

      x.set(currentX);
      rotate.set(currentRotate);

      if (Math.abs(currentX) >= Math.abs(toX)) {
        clearInterval(id);

        // 좌표 초기화
        setTimeout(() => {
          x.set(0);
          rotate.set(0);
          handleDecision(decision);
          setManualAnimating(false); // 다음 카드로 진입
        }, 50);
      }
    }, interval);
  };

  const handleDecision = (decision) => {
    if (!currentPaper) return;
    history.current.push({ decision, paper: currentPaper });
    if (decision === "keep") setKeepList((prev) => [...prev, currentPaper]);
    else setDropList((prev) => [...prev, currentPaper]);
    setIndex((prev) => prev + 1);
    x.set(0);
    rotate.set(0);
    setPendingDecision(null); // ✅ 초기화
  };

  const handleUndo = () => {
    const last = history.current.pop();
    if (!last) return;
    setIndex((prev) => prev - 1);
    if (last.decision === "keep") setKeepList((prev) => prev.slice(0, -1));
    else setDropList((prev) => prev.slice(0, -1));
    x.set(0);
  };

  const goHome = () => {
    setSelectedFile(null);
    setPapers([]);
    setIndex(0);
    setKeepList([]);
    setDropList([]);
    history.current = [];
  };

  const downloadCSV = (filename) => {
    const saved = JSON.parse(localStorage.getItem(filename) || "{}");
    const keepList = saved.keepList || [];
    const dropList = saved.dropList || [];
    const combined = [
      ...keepList.map((p) => ({
        index: p.index ?? 0,
        title: p.title,
        keep: 1,
        drop: 0,
      })),
      ...dropList.map((p) => ({
        index: p.index ?? 0,
        title: p.title,
        keep: 0,
        drop: 1,
      })),
    ];
    const ws = XLSX.utils.json_to_sheet(combined);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename.replace(".xlsx", "")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function highlightAddress(text) {
    const parts = text.split(/(주소)/g); // '주소' 기준 분할 (보존)
    return parts.map((part, i) =>
      part === "주소" ? (
        <span key={i} className="font-bold bg-yellow-200 px-1 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  }

  if (!selectedFile) {
    return (
      <div className="p-6 bg-gradient-to-br from-pink-100 via-purple-100 to-purple-200 h-screen overflow-hidden">
        <h1 className="text-2xl font-bold text-center mb-4">파일 선택</h1>
        <ul className="flex flex-col items-center gap-4">
          {fileList.map((file, idx) => {
            const saved = JSON.parse(localStorage.getItem(file) || "{}");
            const done =
              (saved.keepList?.length || 0) + (saved.dropList?.length || 0);
            return (
              <li
                key={idx}
                className="w-72 bg-white rounded-xl shadow p-4 flex flex-col items-start hover:bg-purple-50 border cursor-pointer"
              >
                <div className="w-full flex justify-between items-center mb-1">
                  <p
                    className="font-semibold text-left cursor-pointer flex-1"
                    onClick={() => loadXLSX(file)}
                  >
                    {file}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // 파일 선택 방지
                      downloadCSV(file);
                    }}
                    className="text-xs bg-green-500 text-white rounded px-2 py-1 ml-2 shadow"
                  >
                    CSV 저장
                  </button>
                </div>
                <p className="text-sm text-gray-500">{done}개 분류됨</p>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!currentPaper) {
    return (
      <div className="p-4 text-center bg-gradient-to-br from-pink-50 to-purple-100 h-screen overflow-hidden relative">
        <h2 className="text-xl font-bold">모든 논문을 분류하였습니다</h2>
        <div className="mt-4 flex flex-col gap-2 items-center z-10">
          <button
            onClick={() => {
              saveProgress();
              setShowPopup(true);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded shadow w-3/4"
          >
            📋 분류 결과 보기
          </button>
          <button
            onClick={goHome}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded shadow w-3/4"
          >
            🏠 홈으로 가기
          </button>
        </div>
        {showPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-lg max-h-[75vh] overflow-y-auto z-50">
              <h3 className="text-lg font-bold mb-2">✅ Keep 목록</h3>
              <ul className="mb-4 list-disc pl-5 text-sm text-left">
                {keepList.map((item, idx) => (
                  <li key={idx}>{item.title}</li>
                ))}
              </ul>
              <h3 className="text-lg font-bold mb-2">❌ Drop 목록</h3>
              <ul className="list-disc pl-5 text-sm text-left">
                {dropList.map((item, idx) => (
                  <li key={idx}>{item.title}</li>
                ))}
              </ul>
              <button
                onClick={() => setShowPopup(false)}
                className="mt-4 px-4 py-2 bg-gray-300 rounded-full text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-between min-h-[100dvh] p-4 bg-gradient-to-br from-pink-100 via-purple-100 to-purple-200">
      {/* 상단 버튼 */}
      <div className="absolute top-2 left-0 right-0 flex flex-wrap justify-center gap-2 px-4 z-30">
        <button
          onClick={handleUndo}
          className="text-gray-600 text-sm bg-white shadow px-3 py-1 rounded-full"
        >
          ↩️뒤로
        </button>
        <button
          onClick={goHome}
          className="text-gray-600 text-sm bg-white shadow px-3 py-1 rounded-full"
        >
          🏠홈으로
        </button>
        <button
          onClick={() => {
            saveProgress();
            setShowPopup(true);
          }}
          className="text-xs bg-white text-purple-600 border border-purple-300 px-4 py-1 rounded-full shadow"
        >
          📋분류결과
        </button>
        <div className="text-xs text-gray-700 self-center">
          {index + 1} / {papers.length}
        </div>
      </div>

      {/* 카드 영역 */}
      <div
        className="relative w-[85vw] max-w-md h-[70vh] z-10 mt-8"
        style={{
          height: `calc(100dvh - 11rem)`, // 176px 정도
        }}
      >
        {nextPaper && (
          <motion.div
            className="absolute inset-0 z-10"
            style={{
              backgroundColor: bgColor,
              borderColor: borderColor,
              borderWidth: 4,
              borderStyle: "solid",
              borderRadius: "30px",
            }}
          />
        )}

        {/* 실제 현재 카드 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPaper.title}
            className="absolute inset-0 z-20 flex items-center justify-center"
            drag={disableDrag ? false : "x"}
            style={{ x, rotate }}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.85}
            onDragEnd={(e, info) => {
              if (disableDrag) return;
              if (info.offset.x > 120) handleDecision("keep");
              else if (info.offset.x < -120) handleDecision("drop");
            }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={
              manualAnimating
                ? {}
                : {
                    opacity: 0,
                    scale: 0.95,
                    x: 0,
                    transition: { duration: 0.25 },
                  }
            }
            transition={{ type: "spring", stiffness: 250, damping: 30 }}
          >
            <motion.div
              className="w-full h-full bg-white rounded-[30px] shadow-2xl p-6 flex flex-col justify-between overflow-hidden"
              style={{
                borderColor: borderColor,
                borderWidth: 4,
                borderStyle: "solid",
              }}
            >
              <h2 className="text-xl font-bold mb-2 text-center px-2">
                {highlightAddress(currentPaper.title)}
              </h2>

              {currentPaper.journal && (
                <p className="italic text-center text-sm text-gray-600 mb-2">
                  {currentPaper.journal}
                </p>
              )}

              {/* ✅ 드래그 차단 이벤트 추가 */}
              <div
                className="overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap text-justify leading-relaxed pr-2 scrollbar-custom"
                style={{ touchAction: "pan-y" }}
                onTouchStart={() => setDisableDrag(true)}
                onTouchEnd={() => setDisableDrag(false)}
              >
                {highlightAddress(currentPaper.abstract)}
              </div>

              <motion.div
                className="text-center font-bold text-2xl mt-2 absolute bottom-2 left-1/2 transform -translate-x-1/2"
                style={{ opacity: opacityKeep, color: "#16a34a" }}
              >
                ✅ KEEP
              </motion.div>
              <motion.div
                className="text-center font-bold text-2xl mt-2 absolute bottom-2 left-1/2 transform -translate-x-1/2"
                style={{ opacity: opacityDrop, color: "#dc2626" }}
              >
                ❌ DROP
              </motion.div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 flex justify-center gap-4 z-30">
        <button
          onClick={() => animateDecision("drop")}
          className="w-16 h-16 rounded-full bg-red-500 text-white text-lg shadow-md"
        >
          ❌
        </button>
        <button
          onClick={handleUndo}
          className="w-16 h-16 rounded-full bg-gray-500 text-white text-lg shadow-md"
        >
          ↩️
        </button>
        <button
          onClick={() => animateDecision("keep")}
          className="w-16 h-16 rounded-full bg-green-500 text-white text-lg shadow-md"
        >
          ✅
        </button>
      </div>

      {/* 팝업 */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-lg max-h-[75vh] overflow-y-auto z-50">
            <h3 className="text-lg font-bold mb-2">✅ Keep 목록</h3>
            <ul className="mb-4 list-disc pl-5 text-sm text-left">
              {keepList.map((item, idx) => (
                <li key={idx}>{item.title}</li>
              ))}
            </ul>
            <h3 className="text-lg font-bold mb-2">❌ Drop 목록</h3>
            <ul className="list-disc pl-5 text-sm text-left">
              {dropList.map((item, idx) => (
                <li key={idx}>{item.title}</li>
              ))}
            </ul>
            <button
              onClick={() => setShowPopup(false)}
              className="mt-4 px-4 py-2 bg-gray-300 rounded-full text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
