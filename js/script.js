const studentTbody = document.getElementById("student-tbody");
const searchInput = document.getElementById("search-input");
const addStudentBtn = document.getElementById("add-student-btn");
const groupSelect = document.getElementById("group-select");

let students = []; // Массив студентов
let allStudents = []; // Массив для хранения всех студентов
let groups = []; // Массив для хранения уникальных групп
const socket = io(); // Инициализация соединения с сервером

// Инициализация данных студентов с сервера
socket.on("filteredStudents", filteredStudents => {
  updateStudentTable(filteredStudents); // Обновляем таблицу с отфильтрованными данными
});

// Инициализация данных студентов с сервера
socket.on("students", data => {
  allStudents = [...data]; // Хранение всех студентов
  groups = [...new Set(allStudents.map(student => student.group_name))]; // Получаем уникальные группы
  populateGroupSelect(); // Заполняем выпадающий список
  updateStudentTable(data); // Первоначальная загрузка студентов
});

// Заполнение выпадающего списка групп
function populateGroupSelect() {
  groupSelect.innerHTML = '<option value="all">Все группы</option>'; // Начальная опция "Все группы"
  groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    groupSelect.appendChild(option);
  });
}

// Функция для фильтрации студентов по группе
function filterStudentsByGroup(selectedGroup) {
  const filteredStudents = selectedGroup === 'all' ? allStudents : allStudents.filter(student => student.group_name === selectedGroup);
  updateStudentTable(filteredStudents);
}

// Обновление таблицы студентов
function updateStudentTable(data) {
  studentTbody.innerHTML = ''; // Очищаем предыдущие данные
  students = [...data]; // Клонируем массив студентов для локального изменения
  data.forEach((student, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
    <td><input class="tt" type="text" value="${student.group_name}" onchange="updateStudentField(${index}, 'group_name', this.value)" /></td>
    <td><input class="tt" type="text" value="${student.name}" onchange="updateStudentField(${index}, 'name', this.value)" /></td>
    <td><input class="tt" type="text" value="${student.date_of_birth}" onchange="updateStudentField(${index}, 'date_of_birth', this.value)" /></td>
    <td><input class="tt" type="text" value="${student.reason_for_adding}" onchange="updateStudentField(${index}, 'reason_for_adding', this.value)" /></td>
    <td><button onclick="removeStudent(${index})">Удалить</button></td>
    <td>
      <input type="file" id="file-${index}" name="document" style="display:none;" onchange="uploadDocument(event, ${index})">
      <button onclick="document.getElementById('file-${index}').click();">Загрузить документ</button>
    </td>
  `;  
    studentTbody.appendChild(row);
  });
}

// Слушаем изменения в выпадающем списке группы
groupSelect.addEventListener("change", () => {
  const selectedGroup = groupSelect.value;
  filterStudentsByGroup(selectedGroup);
});

// Функция удаления студента
function removeStudent(index) {
  const studentToRemove = students[index]; // Извлекаем студента по индексу
  socket.emit("removeStudent", studentToRemove); // Отправляем запрос на сервер для удаления студента
}

// Функция обновления поля студента
function updateStudentField(index, field, value) {
  students[index][field] = value; // Обновляем значение поля в локальном массиве
  const updatedStudent = { ...students[index] };
  socket.emit("updateStudent", updatedStudent); // Отправляем запрос на сервер для обновления студента
}

// Обработка ввода в поле поиска
searchInput.addEventListener("input", () => {
  let searchTerm = searchInput.value.toLowerCase();
  socket.emit("search", searchTerm); // Отправка данных на сервер для поиска
});

// Открытие модального окна для добавления студента
addStudentBtn.addEventListener("click", () => {
  const modal = document.getElementById("modal");
  modal.style.display = "block";
});

// Закрытие модального окна
document.querySelector(".close").addEventListener("click", () => {
  document.getElementById("modal").style.display = "none";
});

// Закрытие модального окна при клике вне его
window.addEventListener("click", (event) => {
  if (event.target === document.getElementById("modal")) {
    document.getElementById("modal").style.display = "none";
  }
});

// Сохранение студента и проверка существования
document.getElementById("save-student").addEventListener("click", () => {
  const name = document.getElementById("student-name").value.trim();
  const group = document.getElementById("student-group").value.trim();
  const dob = document.getElementById("student-dob").value.trim();
  const reason = document.getElementById("student-reason").value.trim();

  if (name && group && dob && reason) {
    const studentData = { name, group_name: group, date_of_birth: dob, reason_for_adding: reason };
    if (!studentExists(studentData)) {
      socket.emit("addStudent", studentData);
      displayNotification("Студент добавлен успешно!");
      document.getElementById("modal").style.display = "none"; // Закрыть модальное окно
    } else {
      displayNotification("Ошибка: Студент уже существует!");
    }
  } else {
    displayNotification("Ошибка: Заполните все поля!");
  }
});

// Проверка существования студента
function studentExists(studentData) {
  return allStudents.some(student =>
    student.group_name === studentData.group_name &&
    student.name === studentData.name &&
    student.date_of_birth === studentData.date_of_birth
  );
}

// Функция для отображения уведомлений
function displayNotification(message) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.style.display = "block";

  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

// Обработка событий добавления студента
socket.on("addStudent", studentData => {
  allStudents.push(studentData);
  filterStudentsByGroup(groupSelect.value); // Обновляем таблицу с учетом фильтрации по группе
});

// Обработка существующего студента
socket.on("studentExists", message => {
  alert(message); // Уведомление о существующем студенте
});
// Функция для загрузки документа через socket.io
function uploadDocument(event, index) {
  const file = event.target.files[0];
  if (file) {
    const fileName = file.name;
      students[index].document = fileName; // Сохраняем имя документа в массив студентов
      const formData = new FormData();
      const reader = new FileReader();
      formData.append("file", file);

      fetch("/upload-document", {
        method: "POST",
        body: formData
      });

      socket.emit("updateStudent", students[index]); // Отправляем обновленные данные на сервер

      reader.onload = () => {
          const fileData = reader.result;
          socket.emit("uploadDocument", { fileData }, fileName);
      };
      reader.readAsDataURL(file);
  }
}
