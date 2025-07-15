
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import { useSwipeable } from "react-swipeable";

export default function PaperSwiper() {
  const [papers, setPapers] = useState([]);
  const [index, setIndex] = useState(0);
  const [keepList, setKeepList] = useState([]);
  const [dropList, setDropList] = useState([]);
  const history = useRef([]);

  const currentPaper = papers[index];

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

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPapers(results.data);
        setIndex(0);
        setKeepList([]);
        setDropList([]);
        history.current = [];
      },
    });
  };

  const exportList = (list, name) => {
    const csv = ["title,abstract", ...list.map(p => `"${p.title}","${p.abstract}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleDecision("drop"),
    onSwipedRight: () => handleDecision("keep"),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  if (!papers || papers.length === 0) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold mb-4">논문 CSV 파일을 업로드해주세요.</h2>
        <input type="file" accept=".csv" onChange={handleCSVUpload} className="mb-4" />
      </div>
    );
  }

  if (!currentPaper) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold">모든 논문을 분류하였습니다.</h2>
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
    <div className="flex flex-col items-center justify-center h-screen p-4 bg-gradient-to-br from-gray-100 to-gray-200" {...swipeHandlers}>
      <p className="mb-2 text-sm text-gray-500">{index + 1} / {papers.length}</p>
      <AnimatePresence>
        <motion.div
          key={currentPaper.title}
          initial={{ x: 200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -200, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="max-w-sm w-screen mx-auto shadow-xl rounded-2xl bg-white px-6 py-5 border border-gray-300">
            <h2 className="text-xl font-semibold mb-3 text-center text-blue-800">{currentPaper.title}</h2>
            <div className="h-[45vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 pr-2">
              <p className="text-sm text-gray-800 whitespace-pre-wrap text-justify leading-relaxed">{currentPaper.abstract}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="flex gap-4 mt-6">
        <button onClick={() => handleDecision("drop")} className="px-4 py-2 bg-red-500 text-white rounded-xl shadow-md">Drop</button>
        <button onClick={() => handleUndo()} className="px-4 py-2 bg-gray-500 text-white rounded-xl shadow-md">Undo</button>
        <button onClick={() => handleDecision("keep")} className="px-4 py-2 bg-blue-500 text-white rounded-xl shadow-md">Keep</button>
      </div>
    </div>
  );
}
