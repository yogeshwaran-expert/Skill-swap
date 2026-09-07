package com.skillswap.repository;

import com.skillswap.entity.SkillType;
import com.skillswap.entity.UserSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserSkillRepository extends JpaRepository<UserSkill, Long> {

    List<UserSkill> findByUserId(Long userId);

    List<UserSkill> findByUserIdAndType(Long userId, SkillType type);

    Optional<UserSkill> findByUserIdAndSkillIdAndType(Long userId, Long skillId, SkillType type);

    boolean existsByUserIdAndSkillIdAndType(Long userId, Long skillId, SkillType type);

    void deleteByUserIdAndSkillId(Long userId, Long skillId);
}
