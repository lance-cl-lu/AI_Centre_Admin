import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import AuthContext from "../context/AuthContext";
import Swal from 'sweetalert2';

function Lab() {
  const location = useLocation();
  const state = location.state;
  const [labinfo, setLabinfo] = useState({});
  const [personalQuotas, setPersonalQuotas] = useState({});
  const [sortColumn, setSortColumn] = useState("username");
  const [sortAsc, setSortAsc] = useState(true);
  const [checkAll, setCheckAll] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    fetchLabInfo();
  }, [state]);

  // 取得群組資訊
  const fetchLabInfo = async () => {
    try {
      const response = await fetch('/api/ldap/lab/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab: state.lab }),
      });
      const data = await response.json();
      if (response.status === 200) {
        setLabinfo(data);
      } else {
        console.error('Error fetching lab info');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // 當 labinfo 更新後，針對每位使用者發出請求，取得個人資訊
  useEffect(() => {
    if (labinfo.memberUid) {
      const fetchUserInfo = async (username) => {
        try {
          const response = await fetch('/api/ldap/user/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
          });
          const data = await response.json();
          return data;
        } catch (error) {
          console.error(`Error fetching info for ${username}:`, error);
          return null;
        }
      };

      Promise.all(
        Object.keys(labinfo.memberUid).map(async (username) => {
          const userInfo = await fetchUserInfo(username);
          return { username, userInfo };
        })
      ).then(results => {
        const quotas = {};
        results.forEach(({ username, userInfo }) => {
          if (userInfo) {
            quotas[username] = {
              cpu_quota: userInfo.cpu_quota,
              mem_quota: userInfo.mem_quota,
              gpu_quota: userInfo.gpu_quota,
              // 組合姓名：若 first_name 與 last_name 存在
              name: userInfo.first_name && userInfo.last_name
                ? `${userInfo.first_name} ${userInfo.last_name}`
                : '',
            };
          }
        });
        setPersonalQuotas(quotas);
      });
    }
  }, [labinfo]);

  const deleteGroup = async () => {
    const swalWithBootstrapButtons = Swal.mixin({
      customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-danger'
      },
      buttonsStyling: false
    });
    swalWithBootstrapButtons.fire({
      title: 'Are you sure to delete this group?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        // 顯示 loading
        Swal.fire({
          title: 'Deleting...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        fetch("/api/ldap/lab/delete/", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lab: state.lab })
        }).then((response) => {
          Swal.close(); // 關閉 loading
          if (response.status === 200) {
            Swal.fire({
              title: 'Deleted!',
              text: 'Your group has been deleted.',
              icon: 'success'
            });
            setTimeout(() => {
              window.location.href = '/';
            }, 1000);
          } else {
            Swal.fire({
              title: 'Error!',
              text: 'Something went wrong.',
              icon: 'error'
            });
          }
        });
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        swalWithBootstrapButtons.fire({
          title: 'Cancelled',
          text: 'Your group is safe.',
          icon: 'error'
        });
      }
    });
  };

  const handleExport = async () => {
    const response = await fetch("/api/ldap/lab/excel/export/", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lab: state.lab })
    });
    if (response.status === 200) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      alert("Error exporting group");
    }
  };

  // 點選表頭觸發排序（針對 Username、Name 與 Permission）
  const handleSort = (column) => {
    let newSortAsc = true;
    if (sortColumn === column) {
      newSortAsc = !sortAsc;
      setSortAsc(newSortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(true);
      newSortAsc = true;
    }
    if (labinfo.memberUid) {
      let sorted = {};
      let keys = Object.keys(labinfo.memberUid);
      if (column === "username") {
        keys.sort((a, b) => newSortAsc ? a.localeCompare(b) : b.localeCompare(a));
      } else if (column === "permission") {
        keys.sort((a, b) => {
          const permA = labinfo.memberUid[a];
          const permB = labinfo.memberUid[b];
          return newSortAsc ? permA.localeCompare(permB) : permB.localeCompare(permA);
        });
      } else if (column === "name") {
        keys.sort((a, b) => {
          const nameA = personalQuotas[a]?.name || "";
          const nameB = personalQuotas[b]?.name || "";
          return newSortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
      }
      keys.forEach((key) => {
        sorted[key] = labinfo.memberUid[key];
      });
      setLabinfo({ ...labinfo, memberUid: sorted });
    }
  };

  // 批次刪除使用者
  const handleMultipleDelete = async () => {
    if (window.confirm("Are you sure to delete these users?")) {
      if (selectedUsers.length === 0) {
        alert("Please select at least one user");
        return;
      }
      const response = await fetch("/api/ldap/user/mutiple/delete/", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: selectedUsers })
      });
      if (response.status === 200) {
        Swal.fire({
          title: 'Delete success',
          text: 'These users have been deleted',
          icon: 'success',
          timer: 2000,
        });
        setTimeout(() => window.location.href = '/', 2000);
      } else {
        const data = await response.json();
        Swal.fire({
          title: 'Delete failed',
          text: data.message,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    }
  };

  // 批次移除使用者
  const handleMultipleRemove = async () => {
    if (window.confirm("Are you sure to remove these users from the group?")) {
      if (selectedUsers.length === 0) {
        alert("Please select at least one user");
        return;
      }
      const response = await fetch("/api/ldap/lab/mutiple/remove/", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: state.lab, users: selectedUsers })
      });
      if (response.status === 200) {
        Swal.fire({
          title: 'Remove success',
          text: 'These users have been removed from the group',
          icon: 'success',
          timer: 2000,
        });
        setTimeout(() => window.history.back(), 2000);
      } else {
        const data = await response.json();
        Swal.fire({
          title: 'Remove failed',
          text: data.message,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    }
  };

  // 全選或取消全選
  const handleCheckAllChange = (e) => {
    if (e.target.checked) {
      const allUsernames = labinfo.memberUid ? Object.keys(labinfo.memberUid) : [];
      setSelectedUsers(allUsernames);
      setCheckAll(true);
    } else {
      setSelectedUsers([]);
      setCheckAll(false);
    }
  };

  // 處理單一 checkbox 變更
  const handleCheckboxChange = (e, username) => {
    if (e.target.checked) {
      setSelectedUsers(prev => [...prev, username]);
    } else {
      setSelectedUsers(prev => prev.filter(u => u !== username));
    }
  };

  return (
    <div className="lab-container">
      <header className="lab-header">
        <h1 className="lab-title">
          {labinfo.labname ? labinfo.labname : ''}
          {labinfo.memberUid ? ` (${Object.keys(labinfo.memberUid).length})` : ' (0)'}
        </h1>
      </header>
      
      {/* 操作連結群組 */}
      <div className="button-group">
        <Link to="/insert" state={{ group: state.lab }} className="link-with-icon">
          <img
            src="/static/add-user.png"
            alt="Add Existed Icon"
            className="icon"
          />
          Add Existed
        </Link>

        <Link to="/add/user" state={{ group: state.lab }} className="link-with-icon">
          <img
            src="/static/add-user.png"
            alt="Add New Icon"
            className="icon"
          />
          Add New
        </Link>

        {selectedUsers.length > 0 && (
          <>
            <span onClick={handleMultipleRemove} className="link-with-icon" style={{ cursor: 'pointer' }}>
              <img
                src="/static/remove-user.png"
                alt="Remove Icon"
                className="icon"
              />
              Remove
            </span>

            <span onClick={handleMultipleDelete} className="link-with-icon" style={{ cursor: 'pointer' }}>
              <img
                src="/static/delete-user.png"
                alt="Delete Icon"
                className="icon"
              />
              Delete
            </span>
          </>
        )}

        <span onClick={handleExport} className="link-with-icon" style={{ cursor: 'pointer' }}>
          <img
            src="/static/export.png"
            alt="Export Icon"
            className="icon"
          />
          Export
        </span>

        <Link to="import" state={{ lab: state.lab }} className="link-with-icon">
          <img
            src="/static/folder.png"
            alt="Import Icon"
            className="icon"
          />
          Import
        </Link>

        <Link to="/edit/group" state={{ lab: state.lab }} className="link-with-icon">
          <img
            src="/static/edit.png"
            alt="Edit Icon"
            className="icon"
          />
          Edit Group
        </Link>
      </div>

      {/* 表格區域 */}
      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th data-label="選取">
                <input
                  type="checkbox"
                  className="checkbox-custom"
                  id="checkAll"
                  checked={checkAll}
                  onChange={handleCheckAllChange}
                />
              </th>
              <th
                data-label="Username"
                onClick={() => handleSort("username")}
                style={{ cursor: 'pointer' }}
                title="Click to sort by Username"
              >
                Username {sortColumn === "username" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th
                data-label="Name"
                onClick={() => handleSort("name")}
                style={{ cursor: 'pointer' }}
                title="Click to sort by Name"
              >
                Name {sortColumn === "name" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th
                data-label="Permission"
                onClick={() => handleSort("permission")}
                style={{ cursor: 'pointer' }}
                title="Click to sort by Permission"
              >
                Permission {sortColumn === "permission" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th data-label="Quota (CPU/Memory/GPU)">Quota (CPU/Memory/GPU)</th>
              <th data-label="Actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {labinfo.memberUid &&
              Object.keys(labinfo.memberUid).map((memberUid) => (
                <tr key={memberUid}>
                  <td data-label="選取">
                    <input
                      type="checkbox"
                      className="checkbox-custom"
                      name="checkbox"
                      checked={selectedUsers.includes(memberUid)}
                      onChange={(e) => handleCheckboxChange(e, memberUid)}
                    />
                  </td>
                  <td data-label="Username" className="username-cell">
                    <Link to="/user" state={{ user: memberUid }} className="link-username">
                      {memberUid}
                    </Link>
                  </td>
                  <td data-label="Name" className="name-cell">
                    {personalQuotas[memberUid]?.name ?? "-"}
                  </td>
                  <td data-label="Permission" className="permission-cell">
                    {labinfo.memberUid[memberUid] === 'admin' ? (
                      <span className="admin-permission">{labinfo.memberUid[memberUid]}</span>
                    ) : (
                      <span>{labinfo.memberUid[memberUid]}</span>
                    )}
                  </td>
                  <td data-label="Quota (CPU/Memory/GPU)" className="quota-cell">
                    {personalQuotas[memberUid]
                      ? `${personalQuotas[memberUid].cpu_quota}/${personalQuotas[memberUid].mem_quota}/${personalQuotas[memberUid].gpu_quota}`
                      : "-"}
                  </td>
                  <td data-label="Actions" className="action-cell">
                    <span
                      onClick={async () => {
                        if (window.confirm("Are you sure to remove this user from this lab?")) {
                          const response = await fetch("/api/ldap/lab/remove/", {
                            method: "POST",
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lab: state.lab, user: memberUid })
                          });
                          if (response.status === 200) {
                            alert("Remove successfully!");
                            window.location.reload();
                          } else {
                            alert("Error removing user");
                          }
                        }
                      }}
                      className="link-with-icon"
                      style={{ cursor: 'pointer' }}
                    >
                      <img
                        src="/static/remove-user.png"
                        alt="Remove Icon"
                        className="icon"
                      />
                      Remove
                    </span>
                    <Link to="/user" state={{ user: memberUid }} className="link-with-icon">
                      <img
                        src="/static/edit.png"
                        alt="Edit Icon"
                        className="icon"
                      />
                      Edit
                    </Link>
                    <span
                      onClick={async () => {
                        const swalWithBootstrapButtons = Swal.mixin({
                          customClass: {
                            confirmButton: 'btn btn-danger',
                            cancelButton: 'btn btn-secondary'
                          },
                          buttonsStyling: false
                        });
                        swalWithBootstrapButtons.fire({
                          title: 'Are you sure to delete this user?',
                          text: "User's data will be deleted permanently!",
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonText: 'Yes, delete it!',
                          cancelButtonText: 'No, cancel!',
                          reverseButtons: true
                        }).then((result) => {
                          if (result.isConfirmed) {
                            // 顯示 loading
                            Swal.fire({
                              title: 'Deleting...',
                              allowOutsideClick: false,
                              didOpen: () => {
                                Swal.showLoading();
                              }
                            });
                            fetch("/api/ldap/user/delete/", {
                              method: "POST",
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ username: memberUid })
                            }).then((response) => {
                              Swal.close(); // 關閉 loading
                              if (response.status === 200) {
                                Swal.fire({
                                  title: 'Deleted!',
                                  text: 'User has been deleted.',
                                  icon: 'success',
                                  timer: 2000,
                                });
                              } else {
                                Swal.fire({
                                  title: 'Error!',
                                  text: 'Something went wrong.',
                                  icon: 'error'
                                });
                              }
                              setTimeout(() => window.location.reload(), 1000);
                            });
                          } else if (result.dismiss === Swal.DismissReason.cancel) {
                            swalWithBootstrapButtons.fire({
                              title: 'Cancelled',
                              text: 'User is safe.',
                              icon: 'error'
                            });
                          }
                        });
                      }}
                      className="link-with-icon"
                      style={{ cursor: 'pointer' }}
                    >
                      <img
                        src="/static/delete-user.png"
                        alt="Delete Icon"
                        className="icon"
                      />
                      Delete
                    </span>
                    <Link to="/password" state={{ user: memberUid }} className="link-with-icon">
                      <img
                        src="/static/password.png"
                        alt="Change Password Icon"
                        className="icon"
                      />
                      Change Password
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="delete-group-container">
        <span onClick={deleteGroup} className="link-with-icon" style={{ cursor: 'pointer' }}>
          <img
            src="/static/delete-user.png"
            alt="Delete Group Icon"
            className="icon"
          />
          Delete Group
        </span>
      </div>
    </div>
  );
}

export default Lab;
