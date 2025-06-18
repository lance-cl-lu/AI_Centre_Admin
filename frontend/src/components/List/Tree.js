import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import './Tree.css';

const TreeView = () => {
  const { userlist, getUserList } = useContext(AuthContext);
  const [expandedGroups, setExpandedGroups] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    getUserList();
  }, []);

  const toggleGroup = (groupDn) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupDn]: !prev[groupDn]
    }));
  };

  const handleGroupClick = (e, groupDn) => {
    // 避免箭頭點擊也觸發跳轉
    if (e.target.closest('.arrow')) return;
    navigate('/lab', { state: { lab: groupDn } });
  };

  const ArrowIcon = ({ expanded }) => (
    <svg
      className="arrow"
      viewBox="0 0 24 24"
      style={{
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        fill: '#888'
      }}
    >
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
    </svg>
  );

  return (
    <div className="tree-container">
      {userlist && userlist.map((user, index) => (
        <div key={index}>
          <div
            className="group-row"
            onClick={(e) => handleGroupClick(e, user.group_dn)}
          >
            <div onClick={() => toggleGroup(user.group_dn)}>
              <ArrowIcon expanded={expandedGroups[user.group_dn]} />
            </div>
            <span className="group-label">{user.group_dn}</span>
          </div>

          {expandedGroups[user.group_dn] && (
            <div className="member-list">
              {user.member_uids.map((uid, idx) => (
                <Link
                  key={idx}
                  to="/user"
                  state={{ user: uid }}
                  className="member-item"
                >
                  {uid}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TreeView;
