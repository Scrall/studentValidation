// Server-side code
const path = require('path');
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const fs = require("fs-extra");
const multer = require("multer");
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // Установка максимального размера файла до 50 MB
  dest: "upload/", // Папка для загруженных файлов
});

app.use(express.static(__dirname + "/js"));
app.use(express.static(__dirname + "/css"));
app.use("/upload", express.static(path.join(__dirname, "upload")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/index.html"));
});

app.get("/main", (req, res) => {
  res.sendFile(path.join(__dirname, "/html2.html"));
});

io.on("connection", (socket) => {
  console.log("Client connected");

  let students = fs.readJSONSync("database.json");
  socket.emit("students", students); // Отправка всех студентов при подключении

  // Handle search input
  socket.on("search", (searchTerm) => {
    const filteredStudents = students.filter(student => {
      return (
        student.group_name.toLowerCase().includes(searchTerm) ||
        student.name.toLowerCase().includes(searchTerm) ||
        student.date_of_birth.toLowerCase().includes(searchTerm) ||
        student.reason_for_adding.toLowerCase().includes(searchTerm)
      );
    });
    socket.emit("filteredStudents", filteredStudents);
  });

  // Handle add student button click
  socket.on("addStudent", (studentData) => {
    students.push(studentData);
    fs.writeFileSync("database.json", JSON.stringify(students, null, 4)); // Обновляем базу данных
    io.emit("students", students); // Уведомляем всех клиентов об обновлении
  });

  // Handle remove student button click
  socket.on("removeStudent", (studentData) => {
    students = students.filter(student => !isSameStudent(student, studentData));
    
    // Удаляем прикрепленный к удаленному студенту файл
    if (studentData.document) {
      const filePathToDelete = path.join(__dirname, "upload", studentData.document);
      fs.unlink(filePathToDelete, (err) => {
        if (err) {
          console.error("Error deleting attached file:", err);
        }
      });
    }
    
    io.emit("students", students); // Уведомляем всех клиентов
    fs.writeFileSync("database.json", JSON.stringify(students, null, 4)); // Обновляем базу данных
  });

  // Handle saving table changes on the server
socket.on("saveTable", (updatedStudents) => {
  students = updatedStudents;
  fs.writeFileSync("database.json", JSON.stringify(students, null, 4)); // Overwrite the database.json file with updated data
  io.emit("loadTable", students); // Notify all clients to reload the table with the saved changes
});
// Обновление данных студента на сервере
socket.on("updateStudent", updatedStudent => {
  const studentIndex = students.findIndex(student => isSameStudent(student, updatedStudent));
  if (studentIndex !== -1) {
    const student = students[studentIndex];
    
    // Если у студента уже есть документ, удаляем его перед загрузкой нового
    if (student.document) {
      const filePathToDelete = path.join(__dirname, "upload", student.document);
      fs.unlink(filePathToDelete, err => {
        if (err) {
          console.error("Error deleting old file:", err);
        }
      });
    }

    students[studentIndex] = updatedStudent;
    fs.writeFileSync("database.json", JSON.stringify(students, null, 4)); // Обновляем базу данных
    io.emit("students", students); // Уведомляем всех клиентов об обновлении
  }
});

// Добавим возможность загрузки файлов через socket.io
socket.on("uploadDocument", (data, fileImya, index) => {
  const fileData = data.fileData;
  const matches = fileData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    socket.emit("documentUploadError", { error: "Invalid file format" });
    return;
  }

  const extension = matches[1].split("/").pop();
  const base64Data = matches[2];

  const fileName = `${fileImya}`;
  const filePath = path.join(__dirname, "upload", fileName);

  require("fs").writeFile(filePath, base64Data, "base64", (err) => {
    if (err) {
      console.error(err);
      socket.emit("documentUploadError", { error: "Error uploading document" });
    } else {
      const student = students[index];
      if (student) {
        student.document = fileName; // Обновляем имя документа у студента
        fs.writeFileSync("database.json", JSON.stringify(students, null, 4)); // Обновляем базу данных
        io.emit("students", students); // Уведомляем всех клиентов об обновлении
        socket.emit("documentUploaded", { fileName });
      } else {
        console.error("Student not found at index:", index);
      }
    }
  });
});

  // Функция сравнения, чтобы определить, одинаковы ли два студента
  function isSameStudent(studentA, studentB) {
    return (
      studentA.group_name === studentB.group_name &&
      studentA.name === studentB.name &&
      studentA.date_of_birth === studentB.date_of_birth &&
      studentA.reason_for_adding === studentB.reason_for_adding
    );
  }
});

http.listen(3000, () => {
  console.log("Server started on port 3000");
});
