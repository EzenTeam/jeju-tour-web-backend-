/** 
 * @Filename: LoginController.js
 * @Author: 구나래(nrggrnngg@gmail.com)
 * @Description: 로그인 여부 확인하고 로그인/로그아웃 분기처리
 */
import express from "express";
import logger from "../helper/LogHelper.js";
import regexHelper from '../helper/RegexHelper.js';
import MemberService from '../services/MemberService.js';
import BadRequestException from "../exceptions/BadRequestException.js";

import cryptojs from 'crypto-js';
import bcrypt from 'bcrypt';

const LoginController = () => {
    const url = "/login";
    const router = express.Router();

    router
        // Login.js `onSubmit={loginUser}` 이벤트 발생 시 post 실행
        .post(url, async (req, res, next) => {
            // 사용자가 입력한 아이디, 비밀번호
            const userid = req.post('userid');
            const userpw = req.post('password');

            // 아이디, 비밀번호 유효성 검사
            try { 
                regexHelper.value(userid, '아이디가 존재하지 않습니다.');
                regexHelper.value(userpw, '비밀번호가 존재하지 않습니다.');
            } catch(err) {
                return next(err);
            }

            // AES알고리즘 사용 --> 프론트에서 전달받은 암호값 복호화 ( 복구 키 필요 )
            const secretKey = 'secret key';
            const bytes = cryptojs.AES.decrypt(userpw, secretKey);
            // 인코딩, 문자열로 변환, JSON 변환 --> 사용자 입력값 도출
            const decrypted = bytes.toString(cryptojs.enc.Utf8);

            // 아이디가 일치하는 회원정보 저장할 변수
            let json = null;

            try {
                // 회원정보 DB에서 가져오기
                json = await MemberService.getLoginUser({
                    userid: userid,
                });
            } catch (err) {
                return next(err);
            }

            // 가져온 회원정보에서 저장된 password값만 추출
            const { password } = json;

            // 비밀번호 비교 (복호화된 원본 비밀번호와 DB에 있는 해시 비밀번호와 비교)
            const checkPassword = await bcrypt.compare(decrypted, password);
            // 비밀번호 체크 후 보내줄 회원정보값
            let memberInfo = null;

            if (checkPassword) { // password 일치 --> 로그인 성공
                req.session.userid = userid;
                req.session.password = password;
                logger.debug('----- req.session json -----');
                logger.debug(JSON.stringify(req.session));
                memberInfo = json;
            } else { // password 불일치 --> 로그인 실패
                const error = new BadRequestException('아이디나 비밀번호를 확인하세요.');
                return next(error);
            }

            //로그인 성공시 세션에 회원정보 저장
            req.session.username = memberInfo.username;
            req.session.birthday = memberInfo.birthday;
            req.session.email = memberInfo.email;
            req.session.profile_img = memberInfo.profile_img;
            req.session.profile_thumb = memberInfo.profile_thumb;

            //브라우저에게는 username값만 전달 -> "000"님 환영합니다.
            res.sendResult({ item: memberInfo });
        })
        .delete(url, async (req, res, next) => {
            try {
                await req.session.destroy();
            } catch (err) {
                return next(err);
            }

            res.sendResult();
        })
        // HTML 페이지 로드시 로그인 여부 검사
        .get(url, (req, res, next) => {
            // 세션에 저장된 아이디, 비밀번호 가져오기
            const userinfo={
                userid : req.session.userid,
                birthday : req.session.birthday,
                email : req.session.email,
                profile_img : req.session.profile_img,
                profile_thumb : req.session.profile_thumb
            }
            // console.log(userinfo);

            // 아이디가 undefined거나 비밀번호가 undefined라면?
            if (userinfo.userid === undefined) {
                const error = new BadRequestException('현재 로그인 중이 아닙니다.');
                return next(error);
            }
            
            //브라우저에 세션에 저장된 회원정보 전달
            res.sendResult({item:userinfo});
        });

    return router;
};

export default LoginController;