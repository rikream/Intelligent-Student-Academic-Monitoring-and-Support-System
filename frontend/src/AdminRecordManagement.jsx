import { useState } from "react";
import { requestApi } from "./apiClient.js";

const initialStudent = {
  username: "",
  roll_number: "",
  name: "",
  department: "",
  semester: "1",
};
const initialSubject = { code: "", name: "", department: "", semester: "1" };

export default function AdminRecordManagement({
  token,
  students,
  subjects,
  enrollments,
  onRefresh,
}) {
  const [studentForm, setStudentForm] = useState(initialStudent);
  const [subjectForm, setSubjectForm] = useState(initialSubject);
  const [enrollmentForm, setEnrollmentForm] = useState({
    student_id: "",
    subject_id: "",
  });
  const [busyForm, setBusyForm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(formName, path, body, successMessage, reset) {
    setBusyForm(formName);
    setError("");
    setNotice("");
    try {
      await requestApi(path, {
        token,
        method: "POST",
        body: JSON.stringify(body),
      });
      reset();
      setNotice(successMessage);
      await onRefresh();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusyForm("");
    }
  }

  return (
    <section id="management" className="dashboard-section" aria-labelledby="management-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">ADMINISTRATION</p>
          <h3 id="management-heading">Academic records</h3>
          <p className="section-description">
            Manage the fictional students, subjects and enrollments used by this prototype.
          </p>
        </div>
      </div>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      <div className="management-grid">
        <section className="panel management-card" aria-labelledby="create-student-heading">
          <div className="card-heading">
            <div className="card-icon indigo" aria-hidden="true">S</div>
            <div>
              <h4 id="create-student-heading">Add a student</h4>
              <p>Create a student demo account and profile.</p>
            </div>
          </div>
          <form
            className="management-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit("student", "/students", {
                ...studentForm,
                semester: Number(studentForm.semester),
              }, "Student profile created.", () => setStudentForm(initialStudent));
            }}
          >
            <label htmlFor="student-username">Username</label>
            <input id="student-username" value={studentForm.username} onChange={(event) => setStudentForm({ ...studentForm, username: event.target.value })} minLength="3" maxLength="64" required />
            <label htmlFor="student-roll-number">Roll number</label>
            <input id="student-roll-number" value={studentForm.roll_number} onChange={(event) => setStudentForm({ ...studentForm, roll_number: event.target.value })} maxLength="32" required />
            <label htmlFor="student-name">Full name</label>
            <input id="student-name" value={studentForm.name} onChange={(event) => setStudentForm({ ...studentForm, name: event.target.value })} maxLength="120" required />
            <div className="form-pair">
              <div>
                <label htmlFor="student-department">Department</label>
                <input id="student-department" value={studentForm.department} onChange={(event) => setStudentForm({ ...studentForm, department: event.target.value })} maxLength="100" required />
              </div>
              <div>
                <label htmlFor="student-semester">Semester</label>
                <input id="student-semester" type="number" min="1" max="16" value={studentForm.semester} onChange={(event) => setStudentForm({ ...studentForm, semester: event.target.value })} required />
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={busyForm !== ""}>
              {busyForm === "student" ? "Creating..." : "Create student"}
            </button>
          </form>
        </section>

        <section className="panel management-card" aria-labelledby="create-subject-heading">
          <div className="card-heading">
            <div className="card-icon violet" aria-hidden="true">C</div>
            <div>
              <h4 id="create-subject-heading">Add a subject</h4>
              <p>Create a subject record for the demo.</p>
            </div>
          </div>
          <form
            className="management-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit("subject", "/subjects", {
                ...subjectForm,
                semester: Number(subjectForm.semester),
              }, "Subject created.", () => setSubjectForm(initialSubject));
            }}
          >
            <label htmlFor="subject-code">Subject code</label>
            <input id="subject-code" value={subjectForm.code} onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value })} maxLength="32" required />
            <label htmlFor="subject-name">Subject name</label>
            <input id="subject-name" value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} maxLength="120" required />
            <div className="form-pair">
              <div>
                <label htmlFor="subject-department">Department</label>
                <input id="subject-department" value={subjectForm.department} onChange={(event) => setSubjectForm({ ...subjectForm, department: event.target.value })} maxLength="100" required />
              </div>
              <div>
                <label htmlFor="subject-semester">Semester</label>
                <input id="subject-semester" type="number" min="1" max="16" value={subjectForm.semester} onChange={(event) => setSubjectForm({ ...subjectForm, semester: event.target.value })} required />
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={busyForm !== ""}>
              {busyForm === "subject" ? "Creating..." : "Create subject"}
            </button>
          </form>
        </section>

        <section className="panel management-card enrollment-card" aria-labelledby="create-enrollment-heading">
          <div className="card-heading">
            <div className="card-icon green" aria-hidden="true">↗</div>
            <div>
              <h4 id="create-enrollment-heading">Enroll a student</h4>
              <p>Students and subjects must have matching department and semester.</p>
            </div>
          </div>
          {students.length === 0 || subjects.length === 0 ? (
            <p className="empty-state">
              Create at least one student and one subject before adding an enrollment.
            </p>
          ) : (
            <form
              className="management-form"
              onSubmit={(event) => {
                event.preventDefault();
                submit("enrollment", "/enrollments", {
                  student_id: Number(enrollmentForm.student_id),
                  subject_id: Number(enrollmentForm.subject_id),
                }, "Student enrolled in the subject.", () => setEnrollmentForm({
                  student_id: "",
                  subject_id: "",
                }));
              }}
            >
              <label htmlFor="enrollment-student">Student</label>
              <select
                id="enrollment-student"
                value={enrollmentForm.student_id}
                onChange={(event) => setEnrollmentForm({ ...enrollmentForm, student_id: event.target.value })}
                required
              >
                <option value="">Select a student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.roll_number} · {student.name}
                  </option>
                ))}
              </select>
              <label htmlFor="enrollment-subject">Subject</label>
              <select
                id="enrollment-subject"
                value={enrollmentForm.subject_id}
                onChange={(event) => setEnrollmentForm({ ...enrollmentForm, subject_id: event.target.value })}
                required
              >
                <option value="">Select a subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} · {subject.name}
                  </option>
                ))}
              </select>
              <button className="primary-button" type="submit" disabled={busyForm !== ""}>
                {busyForm === "enrollment" ? "Enrolling..." : "Create enrollment"}
              </button>
            </form>
          )}
        </section>
      </div>
      <section id="management-students" className="panel roster-panel" aria-labelledby="current-records-heading">
        <div className="section-heading compact">
          <div>
            <h4 id="current-records-heading">Current records</h4>
            <p className="section-description">Live records available to your administrator account.</p>
          </div>
        </div>
        {students.length === 0 ? (
          <p className="empty-state">No student profiles are available yet.</p>
        ) : (
          <div className="table-wrap academic-table-wrap">
            <table>
              <thead>
                <tr><th>Student</th><th>Roll number</th><th>Department</th><th>Semester</th><th>Enrolled subjects</th></tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const studentEnrollments = enrollments.filter((item) => item.student_id === student.id);
                  return (
                    <tr key={student.id}>
                      <td className="person-cell"><span className="person-avatar">{student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span>{student.name}</span></td>
                      <td><span className="table-id">{student.roll_number}</span></td>
                      <td>{student.department}</td>
                      <td>{student.semester}</td>
                      <td>{studentEnrollments.length || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="records-grid">
        <section id="management-subjects" className="panel roster-panel" aria-labelledby="current-subjects-heading">
          <div className="section-heading compact">
            <div>
              <h4 id="current-subjects-heading">Subjects</h4>
              <p className="section-description">Subject records and linked enrollment counts.</p>
            </div>
          </div>
          {subjects.length === 0 ? (
            <p className="empty-state">No subjects are available yet.</p>
          ) : (
            <div className="table-wrap academic-table-wrap">
              <table>
                <thead><tr><th>Subject</th><th>Department</th><th>Semester</th><th>Students</th></tr></thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.id}>
                      <td><span className="subject-code">{subject.code}</span><span className="table-secondary">{subject.name}</span></td>
                      <td>{subject.department}</td>
                      <td>{subject.semester}</td>
                      <td>{enrollments.filter((item) => item.subject_id === subject.id).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel roster-panel" aria-labelledby="current-enrollments-heading">
          <div className="section-heading compact">
            <div>
              <h4 id="current-enrollments-heading">Enrollments</h4>
              <p className="section-description">Student-to-subject access currently in the system.</p>
            </div>
            <span className="section-count">{enrollments.length} records</span>
          </div>
          {enrollments.length === 0 ? (
            <p className="empty-state">No enrollments are available yet.</p>
          ) : (
            <div className="table-wrap academic-table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Subject</th><th>Department</th><th>Semester</th></tr></thead>
                <tbody>
                  {enrollments.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td className="person-cell"><span>{enrollment.student_name}</span><span className="table-secondary">{enrollment.roll_number}</span></td>
                      <td><span className="subject-code">{enrollment.subject_code}</span><span className="table-secondary">{enrollment.subject_name}</span></td>
                      <td>{enrollment.department}</td>
                      <td>{enrollment.semester}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <p className="admin-scope-note">
        Professor account creation and assignment management are not available in the current API.
      </p>
    </section>
  );
}
