import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import './Lab.css';

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
        fetch("/api/ldap/lab/delete/", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lab: state.lab })
        }).then((response) => {
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
<<<<<<< HEAD
    const handleCheckAllChange = (event) => {
        if(event.target.checked) {
            console.log("check all");
            setCheckAll(true);
            let checkboxes = document.getElementsByName('checkbox');
            for(let i=0; i<checkboxes.length; i++) {
                checkboxes[i].checked = true;
            }
        } else {
            setCheckAll(false);
            let checkboxes = document.getElementsByName('checkbox');
            for(let i=0; i<checkboxes.length; i++) {
                checkboxes[i].checked = false;
            }
        }
    }
    return (
        <div>
                <h1 style={{fontFamily: "Comic Sans MS"}}>{labinfo ? labinfo.labname : null} Members  <ContactPageIcon fontSize='large'/></h1>
            <br/>
            <Container style={{display: "flex", justifyContent: "center", alignItems: "center"}}>
                <div style={{ flex: "0 0 20%", padding: "10px" }}>
                    <Text style={{fontFamily: "Comic Sans MS", fontSize:"20px", color:"orange"}}># of group members: {labinfo ? labinfo.memberUid ? Object.keys(labinfo.memberUid).length : 0 : null}</Text>
                </div>
                <div style={{ flex: "0 0 80%", padding: "10px", display: "flex", justifyContent: "center" }}>
                    <Link to="/insert" state={{'group': state.lab}} style={{textDecoration: 'none', color: "#FFFFFF", marginLeft: "2vh", backgroundColor: "navy",}} class="btn btn-primary"><Button style={{ backgroundColor:"navy"}}>Add existed user</Button></Link>
                    <Link to="/add/user" style={{textDecoration: 'none', color: "#FFFFFF",marginLeft: "2vh", backgroundColor: "purple"}} state={{"group": state.lab}} class="btn btn-primary"><Button style={{ backgroundColor: "purple"}}>Add new user</Button></Link>
                    <Button variant="success" style={{marginLeft: "2vh"}} onClick={handleOnclick_mutiple_remove}>Mutiple Remove</Button>
                    <Button variant="danger" style={{marginLeft: "2vh"}} onClick={handleOnclick_mutiple_delete}>Mutiple Delete</Button> 
                    <Button variant="secondary" style={{marginLeft: "2vh"}} onClick={handleOnclick_export}>Export Group</Button>
                    <Link class="btn btn-info" to="import" state={{'lab': state.lab}} style={{marginLeft: "2vh", textDecoration: 'none', color: "#FFFFFF"}}><Button variant="info" color='rgb(255, 255, 255);' >Import Group</Button></Link>
                    <Button variant='success' style={{marginLeft: "2vh"}} onClick={handleSort} id="buttonSort">Sort with ascending</Button>
                    <Link to="/edit/group" state={{'lab': state.lab}} style={{marginLeft: "2vh", textDecoration: 'none', color: "#FFFFFF"}} class="btn btn-warning"><Button variant="warning">Edit Group</Button></Link>
                </div>
            </Container>
            <br/>
            <Table striped bordered hover style={{borderWidth:"20px", boxShadow: "rgba(0, 0, 0, 0.15) 1.95px 1.95px 2.6px", borderRadius: "20px"}}>
                <Box style={{ display: "flex" }}>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}} ><input type="checkbox" style={{width:"20px", height:"12px", display: "inline-flex", justifyContent: "center", alignItems: "center", cursor: "pointer"}} id="checkAll" onChange={handleCheckAllChange} /></th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}} >Username</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>permission</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Remove</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Edit</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Delete</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Change password</th>
                </Box>
                    { labinfo && labinfo.memberUid ? Object.keys(labinfo.memberUid).map((memberUid, index) => (
                        <tr>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><input type="checkbox" style={{width:"20px", height:"12px"}} name="checkbox" /></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><Link to="/user" state={{ "user": memberUid }} style={{textDecoration:"none", border: "none"}}>{memberUid}</Link></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>{labinfo.memberUid[memberUid] === 'admin' ? <span style={{color: "#A020F0", border: "none"}}>{labinfo.memberUid[memberUid]}</span>: <span>{labinfo.memberUid[memberUid]}</span>}</td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%", border: "none"}}><Button style={{ backgroundColor: "Gold", color: "#242424"}} onClick={
                                async() => {
                                    if(window.confirm("Are you sure to remove this user from this lab?")){
                                        let response = await fetch("/api/ldap/lab/remove/", {
                                            method: "POST",
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({'lab': state.lab, 'user': memberUid})
                                        });
                                        if(response.status===200) {
                                            alert("Remove sucessfully!!")
                                            window.location.href='/'
                                        } else {
                                            alert("error");
                                        }
                                    }
                                }
                            }>Remove</Button></div></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%", border: "none"}}><Button variant="secondary"><Link to="/user" state={{"user": memberUid}} style={{textDecoration: "none", color:"#FFFFFF", height: "100%", width: "100%"}} >Edit</Link></Button></div></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%", border: "none"}}><Button variant="danger" onClick={  
                                async() => {
                                    const swalWithBootstrapButtons = Swal.mixin({
                                        customClass: {
                                          confirmButton: "btn btn-danger alert-btn",
                                          cancelButton: "btn btn-warning alert-btn"
                                        },
                                        buttonsStyling: false
                                      });
                                      swalWithBootstrapButtons.fire({
                                        title: "Are you sure to delete this user?",
                                        text: "You won't be able to revert this! All the user's data(including Notebooks, images...etc.) will be deleted",
                                        icon: "warning",
                                        showCancelButton: true,
                                        confirmButtonText: "Yes, delete it!",
                                        cancelButtonText: "No, cancel!",
                                        reverseButtons: true
                                      }).then((result) => {
                                        if (result.isConfirmed) {
                                            fetch("/api/ldap/user/delete/", {
                                                method: "POST",
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                },
                                                body: JSON.stringify({'username': memberUid})
                                            }).then((response) => {
                                                if(response.status===200) {
                                                    Swal.fire({
                                                        title: "Deleted!",
                                                        text: "Your user has been deleted.",
                                                        timer: 2000,
                                                        timerProgressBar: true,
                                                        icon: "success"
                                                    });

                                                } else {
                                                    Swal.fire({
                                                        title: "Error!",
                                                        text: "Something wrong",
                                                        icon: "error"
                                                    });
                                                }
                                                setTimeout(() => {
                                                    window.location.reload();
                                                }, 1000);
                                            });
                                        } else if (
                                          /* Read more about handling dismissals below */
                                          result.dismiss === Swal.DismissReason.cancel
                                        ) {
                                          swalWithBootstrapButtons.fire({
                                            title: "Cancelled",
                                            text: "Your imaginary file is safe :)",
                                            icon: "error"
                                          });
                                        }
                                      });
                                }
                            } >Delete</Button></div></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%", border: "none", display: "grid",  alignContent: "center"}}><Button variant="info"><Link to="/password" style={{textDecoration: "none", color: "#FFFFFF"}} state={{"user": memberUid}}>Change Password</Link></Button></div></td>
                        </tr>
                    )) : null  
                    }
            <br/>
            <Button variant="danger" onClick={deleteGroup} style={{marginTop: "20px", marginBottom: "10px"}}>Delete group</Button>
            </Table>
        </div>
    );
=======
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
            src="https://www.cgu.edu.tw/Uploads/upload/a2b6632c-c69c-4f98-adfc-212ed310cb4f.png"
            alt="Add Existed Icon"
            className="icon"
          />
          Add Existed
        </Link>

        <Link to="/add/user" state={{ group: state.lab }} className="link-with-icon">
          <img
            src="https://www.cgu.edu.tw/Uploads/upload/ae164021-14c4-43cc-9672-a0e740843bae.png"
            alt="Add New Icon"
            className="icon"
          />
          Add New
        </Link>

        {selectedUsers.length > 0 && (
          <>
            <span onClick={handleMultipleRemove} className="link-with-icon" style={{ cursor: 'pointer' }}>
              <img
                src="https://www.cgu.edu.tw/Uploads/upload/2cf1239c-f4b0-4e20-ba3d-307f9ddb6d0d.png"
                alt="Remove Icon"
                className="icon"
              />
              Remove
            </span>

            <span onClick={handleMultipleDelete} className="link-with-icon" style={{ cursor: 'pointer' }}>
              <img
                src="https://www.cgu.edu.tw/Uploads/upload/64f74f69-6c8f-43f1-8fe6-55c850f68a1d.png"
                alt="Delete Icon"
                className="icon"
              />
              Delete
            </span>
          </>
        )}

        <span onClick={handleExport} className="link-with-icon" style={{ cursor: 'pointer' }}>
          <img
            src="https://www.cgu.edu.tw/Uploads/upload/dda8f7ac-8876-43d0-940d-4eb084fd9ad8.png"
            alt="Export Icon"
            className="icon"
          />
          Export
        </span>

        <Link to="import" state={{ lab: state.lab }} className="link-with-icon">
          <img
            src="https://www.cgu.edu.tw/Uploads/upload/7fc516af-0adb-4f48-a11d-e5065576fa8e.png"
            alt="Import Icon"
            className="icon"
          />
          Import
        </Link>

        <Link to="/edit/group" state={{ lab: state.lab }} className="link-with-icon">
          <img
            src="https://www.cgu.edu.tw/Uploads/upload/ee935aa7-7672-4350-b860-9ce3c4e4582f.png"
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
                        src="https://www.cgu.edu.tw/Uploads/upload/2cf1239c-f4b0-4e20-ba3d-307f9ddb6d0d.png"
                        alt="Remove Icon"
                        className="icon"
                      />
                      Remove
                    </span>
                    <Link to="/user" state={{ user: memberUid }} className="link-with-icon">
                      <img
                        src="https://www.cgu.edu.tw/Uploads/upload/ee935aa7-7672-4350-b860-9ce3c4e4582f.png"
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
                            fetch("/api/ldap/user/delete/", {
                              method: "POST",
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ username: memberUid })
                            }).then((response) => {
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
                        src="https://www.cgu.edu.tw/Uploads/upload/64f74f69-6c8f-43f1-8fe6-55c850f68a1d.png"
                        alt="Delete Icon"
                        className="icon"
                      />
                      Delete
                    </span>
                    <Link to="/password" state={{ user: memberUid }} className="link-with-icon">
                      <img
                        src="https://www.cgu.edu.tw/Uploads/upload/edd13300-5c0a-4304-be20-026bee3b9138.png"
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
            src="https://www.cgu.edu.tw/Uploads/upload/0e801b6c-938f-4926-a005-b43ea832806a.png"
            alt="Delete Group Icon"
            className="icon"
          />
          Delete Group
        </span>
      </div>
    </div>
  );
>>>>>>> 52918da (Modify the web front end)
}

export default Lab;
