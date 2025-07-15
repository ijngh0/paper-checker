import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import * as XLSX from "xlsx";

const FILE_LIST = [
  "papers_01.xlsx",
  "papers_02.xlsx",
  "papers_03.xlsx"
];

export default function PaperSwiper() {
  const [fileList, setFileList] = useState(FILE_LIST);
  const [selectedFile, setSelectedFile] = useState(null);
  const [papers, setPapers] = useState([]);
  const [index, setIndex] = useState(0);
  const [keepList, setKeepList] = useState([]);
  const [dropList, setDropList] = useState([]);
  const history = useRef([]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-25, 0, 25]);

  const currentPaper = papers[index];

  // XLSX 파일 불러오기
  const loadXLSX = (filename) => {
    fetch(`/papers/${filename}`)
      .then((res) => res.arrayBuffer())
      .then((arrayBuffer) => {
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        const parsed = json.map(row => ({
          title: row["논문제목"] || "(제목 없음)",
          abstract: row["초록"] || "(초록 없음)"
        }));

        const savedProgress = JSON.parse(localStorage.getItem(filename) || '{}');
        setSelectedFile(filename);
        setPapers(parsed);
        setIndex(savedProgress.index || 0);
        setKeepList(savedProgress.keepList || []);
        setDropList(savedProgress.dropList || []);
        history.current = savedProgress.history || [];
      });
  };

  const saveProgress = () => {
    if (!selectedFile) return;
    const data = {
      index,
      keepList,
      dropList,
      history: history.current,
    };
    localStorage.setItem(selectedFile, JSON.stringify(data));
  };

  useEffect(() => {
    saveProgress();
  }, [index]);

  const handleDecision = (decision) => {
    if (!currentPaper) return;
    history.current.push({ decision, paper: currentPaper });
    if (decision === "keep") setKeepList((prev) => [...prev, currentPaper]);
    else setDropList((prev) => [...prev, currentPaper]);
    setIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    const last = history.current.pop();
    if (!last) return;
    setIndex((prev) => prev - 1);
    if (last.decision === "keep") setKeepList((prev) => prev.slice(0, -1));
    else setDropList((prev) => prev.slice(0, -1));
  };

  const exportList = (list, name) => {
    const ws = XLSX.utils.json_to_sheet(list);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${name}.xlsx`);
  };

  if (!selectedFile) {
    return (
      <div className="p-6 bg-gradient-to-br from-pink-50 to-purple-100 h-screen">
        <h1 className="text-2xl font-bold text-center mb-4">XLSX 파일 선택</h1>
        <ul className="flex flex-col items-center gap-4">
          {fileList.map((file, idx) => {
            const saved = JSON.parse(localStorage.getItem(file) || '{}');
            const doneCount = (saved.keepList?.length || 0) + (saved.dropList?.length || 0);
            return (
              <li
                key={idx}
                className="w-72 bg-white rounded-xl shadow p-4 hover:bg-purple-50 cursor-pointer text-center border"
                onClick={() => loadXLSX(file)}
              >
                <p className="font-semibold">{file}</p>
                <p className="text-sm text-gray-500">{doneCount}개 분류됨</p>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!currentPaper) {
    return (
      <div className="p-4 text-center bg-gradient-to-br from-pink-50 to-purple-100 h-screen">
        <h2 className="text-xl font-bold">모든 논문을 분류하였습니다</h2>
        <div className="mt-4">
          <div className="flex flex-col gap-2 items-center">
            <button onClick={() => exportList(keepList, "keep_list")}
              className="px-4 py-2 bg-green-600 text-white rounded shadow w-3/4">✅ Keep 목록 다운로드</button>
            <button onClick={() => exportList(dropList, "drop_list")}
              className="px-4 py-2 bg-red-600 text-white rounded shadow w-3/4">❌ Drop 목록 다운로드</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4 bg-gradient-to-br from-pink-50 to-purple-100 overflow-hidden">
      <p className="mb-2 text-sm text-gray-500">{index + 1} / {papers.length}</p>
      <div className="relative w-full h-[65vh] max-w-md">
        <AnimatePresence>
          <motion.div
            key={currentPaper.title}
            className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center"
            drag="x"
            style={{ x, rotate }}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={(event, info) => {
              if (info.offset.x > 100) handleDecision("keep");
              else if (info.offset.x < -100) handleDecision("drop");
            }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <div className="w-[90vw] max-w-md h-[65vh] bg-white rounded-[30px] shadow-2xl border-4 border-gray-300 p-6 flex flex-col justify-between relative overflow-hidden">
              <h2 className="text-xl font-bold text-purple-800 mb-4 text-center px-2">{currentPaper.title}</h2>
              <div className="overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap text-justify leading-relaxed pr-2">
                {currentPaper.abstract}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex gap-4 mt-6 z-10">
        <button onClick={() => handleDecision("drop")} className="w-16 h-16 rounded-full bg-red-500 text-white text-lg shadow-md">❌</button>
        <button onClick={() => handleUndo()} className="w-16 h-16 rounded-full bg-gray-500 text-white text-lg shadow-md">↩️</button>
        <button onClick={() => handleDecision("keep")} className="w-16 h-16 rounded-full bg-green-500 text-white text-lg shadow-md">✅</button>
      </div>
    </div>
  );
}
