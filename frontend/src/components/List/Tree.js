import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import './Tree.css';

const TreeView = () => {
  const { userlist, getUserList } = useContext(AuthContext);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getUserList();
  }, []);

  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredGroups = (userlist || []).reduce((groups, group) => {
    const members = Array.isArray(group.member_uids) ? group.member_uids : [];
    const matchedMembers = normalizedKeyword
      ? members.filter((uid) => uid.toLowerCase().includes(normalizedKeyword))
      : members;

    if (!normalizedKeyword || matchedMembers.length > 0) {
      groups.push({
        ...group,
        filteredMembers: matchedMembers,
      });
    }

    return groups;
  }, []);

  const totalMatches = normalizedKeyword
    ? filteredGroups.reduce((count, group) => count + group.filteredMembers.length, 0)
    : 0;

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
      <div className="tree-search">
        <input
          type="text"
          className="tree-search-input"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder="Search user"
          aria-label="Search user"
        />
        {searchKeyword ? (
          <button
            type="button"
            className="tree-search-clear"
            onClick={() => setSearchKeyword('')}
          >
            Clear
          </button>
        ) : null}
      </div>

      {normalizedKeyword ? (
        <div className="tree-search-summary">
          {totalMatches} {totalMatches === 1 ? 'user' : 'users'} matched
        </div>
      ) : null}

      {filteredGroups.map((user, index) => {
        const isExpanded = normalizedKeyword ? true : Boolean(expandedGroups[user.group_dn]);
        return (
        <div key={index}>
          <div
            className="group-row"
            onClick={(e) => handleGroupClick(e, user.group_dn)}
          >
            <div onClick={() => toggleGroup(user.group_dn)}>
              <ArrowIcon expanded={isExpanded} />
            </div>
            <span className="group-label">{user.group_dn}</span>
          </div>

          {isExpanded && (
            <div className="member-list">
              {user.filteredMembers.map((uid, idx) => (
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
      )})}

      {userlist && filteredGroups.length === 0 ? (
        <div className="tree-empty">No users found.</div>
      ) : null}
    </div>
  );
};

export default TreeView;
