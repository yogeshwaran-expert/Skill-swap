package com.skillswap.repository;

import com.skillswap.entity.Group;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupRepository extends JpaRepository<Group, Long> {

    Page<Group> findBySkillId(Long skillId, Pageable pageable);

    @Query("SELECT g FROM Group g WHERE g.skill.category = :category")
    Page<Group> findBySkillCategory(@Param("category") String category, Pageable pageable);

    @Query("SELECT g FROM Group g WHERE LOWER(g.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Group> searchByName(@Param("search") String search, Pageable pageable);
}
